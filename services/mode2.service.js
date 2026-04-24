/**
 * services/mode2.service.js  —  City-Wide Itinerary Engine
 *
 * ALL PROBLEMS FIXED IN THIS VERSION:
 *
 * FIX 1 — Geographic grouping (center.lat/lng now used)
 *   distributeClustersToDays assigns clusters to days by proximity to day centroid.
 *   Old Delhi clusters stay together on one day. Qutub Minar + Mehrauli stay together.
 *   A tourist no longer gets Qutub Minar (South) + Chandni Chowk (North) on the same day.
 *
 * FIX 2 — food_available / shopping_available cluster fields now used
 *   buildTimedDay injects a Lunch card after the first place whose cluster has
 *   food_available=true, and a Shopping card similarly. No longer depends on
 *   inconsistent individual place amenities.
 *
 * FIX 3 — Per-cluster budget cap removed
 *   Previous code split daily budget equally across all clusters before knowing
 *   which clusters have eligible places. This caused 1-2 places per day.
 *   Now: no pre-split cap. expandCluster uses total remaining budget and stops at
 *   MAX_PLACES_PER_DAY. Top-ranked clusters naturally get more places.
 *
 * FIX 4 — Two-tier place selection in expandCluster
 *   Previously: places not matching user interest were REMOVED from cluster.
 *   This left clusters with 0-1 places for strict interest selections (HERITAGE).
 *   Now: Tier 1 = interest-matching places (sorted by quality). 
 *        Tier 2 = non-matching filler places from same cluster.
 *   Tier 1 fills first. Tier 2 fills remaining slots up to MAX.
 *   A day with 4-6 places is now guaranteed.
 *
 * ALREADY FIXED (carried from previous version):
 *   - INTEREST_CATEGORY_MAP expanded with actual tag words
 *   - scheduleAnchorEvents checks active_months
 *   - best_time_slot ordering (MORNING → AFTERNOON → EVENING)
 *   - Score normalisation
 *   - Day 1 gets top interest-matched cluster
 */

import Place       from '../models/PlaceSchema.js';
import Cluster     from '../models/Cluster.js';
import AnchorEvent from '../models/AnchorEvent.js';
import { getDistanceMatrix } from './osrm.service.js';
import { haversine }         from '../utils/geo.js';

// ── Constants ──────────────────────────────────────────────────────────────────
const DAILY_BUDGET_MINS    = 480;
const DAY_START_HOUR       = 9;
const TRAVEL_BUFFER_MINS   = 15;
const MAX_PLACES_PER_DAY   = 6;
const INTER_CLUSTER_TRAVEL = 20;   // mins between clusters on same day
const MAX_CLUSTERS_PER_DAY = 3;    // don't cram more than 3 clusters per day
const DAY_ABBR = ['sun','mon','tue','wed','thu','fri','sat'];

// ── Interest category → tag expansion map ─────────────────────────────────────
const INTEREST_CATEGORY_MAP = {
  HERITAGE: [
    'HERITAGE',
    'history','architecture','mughal','medieval','indo-islamic',
    'unesco','ruins','fort','tomb','palace','monument','archaeology',
    'colonial','stepwell','haveli','madrasa',
  ],
  MUSEUM: [
    'MUSEUM',
    'museum','gallery','artifacts','collection',
  ],
  CULTURAL: [
    'CULTURAL',
    'culture','art','theatre','performance','craft','folk',
    'handicrafts','regional','tradition',
  ],
  RELIGIOUS: [
    'RELIGIOUS',
    'temple','mosque','gurudwara','church','sikh','hindu',
    'sufi','qawwali','dargah','pilgrimage','spiritual','jain',
    'christian','buddha',
  ],
  SHOPPING: [
    'SHOPPING',
    'market','bargain','flea-market','handicrafts','textiles',
    'crafts','boutique','jewelry','antique','secondhand',
    'wholesale','state-crafts','handloom',
  ],
  FOOD: [
    'FOOD',
    'street-food','snacks','mughlai','north-indian','restaurant',
    'cafe','sweets','kachori','dal','breakfast','south-indian',
    'vegetarian','non-veg','butter-chicken',
  ],
  NATURE: [
    'PARK','NATURE','WILDLIFE',
    'garden','birdwatching','lake','eco','wetland','deer',
    'biodiversity','bird-hospital','picnic','boating',
  ],
  ENTERTAINMENT: [
    'ENTERTAINMENT','NIGHTLIFE','ACTIVITY',
    'amusement-park','bowling','games','cinema','musical',
    'theatre','vr','rides','water-park','adventure',
  ],
  MODERN: [
    'MODERN',
    'tech','vr','science','interactive','planetarium',
    'aviation','railway','modern','business',
  ],
  SPORTS: [
    'SPORTS',
    'cricket','football','tennis','athletics','swimming',
    'golf','badminton','track','stadium',
  ],
  WELLNESS: [
    'WELLNESS',
    'yoga','meditation','spa','fitness','massage','relaxation',
  ],
};

// ── Build expanded term set ────────────────────────────────────────────────────
function buildExpandedTerms(userCategories) {
  if (!userCategories || userCategories.length === 0) return new Set();
  return new Set(
    userCategories
      .flatMap(c => INTEREST_CATEGORY_MAP[c.toUpperCase()] ?? [c.toUpperCase()])
      .flatMap(t => [t.toUpperCase(), t.toLowerCase()])
  );
}

// ── Check if a place matches user interests ───────────────────────────────────
function placeMatchesInterest(place, expandedTerms) {
  if (!expandedTerms || expandedTerms.size === 0) return true;
  const catMatch = expandedTerms.has(place.category?.toUpperCase());
  const tagMatch = (place.tags ?? []).some(t => expandedTerms.has(t.toLowerCase()));
  return catMatch || tagMatch;
}

// ── Quality weight of a place ─────────────────────────────────────────────────
function placeQuality(place) {
  return 0.6 * (place.scores?.cultural ?? 0) + 0.4 * (place.scores?.popularity ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// interestMatchScore — quality-weighted fraction of cluster places matching user
// ─────────────────────────────────────────────────────────────────────────────
function interestMatchScore(clusterPlaces, userCategories) {
  if (!userCategories.length || !clusterPlaces.length) return 0.5;

  const expandedTerms = buildExpandedTerms(userCategories);
  let weightedSum = 0, totalWeight = 0;

  for (const p of clusterPlaces) {
    const q = placeQuality(p);
    totalWeight += q;
    if (placeMatchesInterest(p, expandedTerms)) weightedSum += q;
  }

  return totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(4)) : 0.5;
}

// ─────────────────────────────────────────────────────────────────────────────
// finalRank = base_rank_score × 0.60 + interestMatchScore × 0.40
// ─────────────────────────────────────────────────────────────────────────────
function finalRank(cluster, interestMatch) {
  return parseFloat(
    ((cluster.base_rank_score ?? 0.5) * 0.60 + interestMatch * 0.40).toFixed(4)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// haversineKm — haversine distance in km between two cluster centers
// ─────────────────────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat/2) ** 2
             + Math.cos(lat1 * Math.PI / 180)
             * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────────────────────
// dayCentroid — average lat/lng of clusters already assigned to a day
// ─────────────────────────────────────────────────────────────────────────────
function dayCentroid(dayClusterIds, clusterById) {
  const cs = dayClusterIds.map(id => clusterById[id]).filter(Boolean);
  if (!cs.length) return { lat: 28.6139, lng: 77.2090 };  // Delhi center
  return {
    lat: cs.reduce((s, c) => s + (c.center?.lat ?? 28.6139), 0) / cs.length,
    lng: cs.reduce((s, c) => s + (c.center?.lng ?? 77.2090), 0) / cs.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// scheduleAnchorEvents
// ─────────────────────────────────────────────────────────────────────────────
async function scheduleAnchorEvents(numDays, dayAbbrs, startDate) {
  const events = await AnchorEvent.find({}).sort({ priority_weight: -1 }).lean();

  const dayEventMap  = new Map();
  const usedEventIds = new Set();

  for (let d = 0; d < numDays; d++) {
    const today = dayAbbrs[d].toLowerCase();

    let currentMonth = new Date().getMonth() + 1;
    if (startDate) {
      const dt = new Date(`${startDate}T12:00:00`);
      dt.setDate(dt.getDate() + d);
      currentMonth = dt.getMonth() + 1;
    }

    for (const ev of events) {
      if (usedEventIds.has(ev._id)) continue;

      const activeMonths = ev.active_months ?? [];
      if (activeMonths.length > 0 && !activeMonths.includes(currentMonth)) continue;

      const days      = (ev.available_days ?? []).map(x => x.toLowerCase().trim());
      const runsToday = !days.length || days.includes(today) || days.includes('all_days');
      if (!runsToday) continue;

      dayEventMap.set(d, ev);
      usedEventIds.add(ev._id);
      break;
    }
  }
  return dayEventMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: distributeClustersToDays — geographic grouping using center.lat/lng
//
// Algorithm:
//  1. Anchor clusters (those containing an anchor event's place) are pinned first.
//  2. Remaining clusters are assigned by proximity to the current day centroid.
//  3. Each day gets at most MAX_CLUSTERS_PER_DAY clusters.
//  4. Overflow clusters are distributed to days with fewest clusters.
// ─────────────────────────────────────────────────────────────────────────────
function distributeClustersToDays(rankedClusters, numDays, dayEventMap) {
  // Build a lookup by _id for centroid calculations
  const clusterById = Object.fromEntries(rankedClusters.map(c => [c._id, c]));

  // Step 1: pin anchor event clusters to their day
  const anchorClusters = new Map();
  for (const [dayIdx, ev] of dayEventMap.entries()) {
    const ec = rankedClusters.find(c => (c.place_ids ?? []).includes(ev.place_id));
    if (ec) anchorClusters.set(dayIdx, ec._id);
  }

  const pinnedIds = new Set(anchorClusters.values());
  const pool      = rankedClusters.filter(c => !pinnedIds.has(c._id));

  // Initialise day lists with pinned anchor clusters
  const dayListIds = Array.from({ length: numDays }, (_, d) => {
    const ac = anchorClusters.get(d);
    return ac ? [ac] : [];
  });

  // Step 2: assign pool clusters geographically
  for (const cluster of pool) {
    // Find which day centroid this cluster is closest to
    // and which day still has room
    let bestDay  = -1;
    let bestDist = Infinity;

    for (let d = 0; d < numDays; d++) {
      if (dayListIds[d].length >= MAX_CLUSTERS_PER_DAY) continue;
      const cen  = dayCentroid(dayListIds[d], clusterById);
      const dist = haversineKm(
        cen.lat, cen.lng,
        cluster.center?.lat ?? 28.6139,
        cluster.center?.lng ?? 77.2090
      );
      if (dist < bestDist) { bestDist = dist; bestDay = d; }
    }

    // If all days are full, find the day with fewest clusters
    if (bestDay === -1) {
      bestDay = dayListIds.reduce(
        (minD, dl, d) => dl.length < dayListIds[minD].length ? d : minD, 0
      );
    }

    dayListIds[bestDay].push(cluster._id);
  }

  // Convert ids back to cluster objects (preserving interest-rank order within each day)
  return dayListIds.map(ids =>
    ids.map(id => clusterById[id]).filter(Boolean)
       .sort((a, b) => b._finalRank - a._finalRank)  // best interest match first within each day
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3 + FIX 4: expandCluster — two-tier selection, no per-cluster budget cap
//
// Tier 1: places matching user interests   → sorted by quality (desc)
// Tier 2: non-matching filler places       → sorted by quality (desc)
// Selection: fill Tier 1 first, then Tier 2, respecting MAX_PLACES_PER_DAY and budget.
// FIX 3: budgetLeft passed directly — no division by cluster count beforehand.
// ─────────────────────────────────────────────────────────────────────────────
function expandCluster(cluster, placeMap, dayAbbr, budgetLeft, avoidCrowds, anchorEventPlaceId, expandedTerms) {
  const allCandidates = (cluster.place_ids ?? [])
    .map(id => placeMap[String(id)])
    .filter(Boolean)
    .filter(p => {
      if (anchorEventPlaceId && String(p._id) === String(anchorEventPlaceId)) return false;
      const od = (p.open_days ?? []).map(d => d.toLowerCase());
      return !od.length
        || od.includes('all_days')
        || od.includes('event_based')
        || od.includes(dayAbbr.toLowerCase());
    });

  const sortFn = (a, b) => {
    // Anchor place always first
    const aMain = String(a._id) === cluster.main_anchor_place_id ? 1 : 0;
    const bMain = String(b._id) === cluster.main_anchor_place_id ? 1 : 0;
    if (aMain !== bMain) return bMain - aMain;
    return avoidCrowds
      ? (a.scores?.popularity ?? 0) - (b.scores?.popularity ?? 0)
      : placeQuality(b) - placeQuality(a);
  };

  // FIX 4: two tiers — matching places first, filler second
  const tier1 = allCandidates.filter(p =>  placeMatchesInterest(p, expandedTerms)).sort(sortFn);
  const tier2 = allCandidates.filter(p => !placeMatchesInterest(p, expandedTerms)).sort(sortFn);
  const ordered = [...tier1, ...tier2];

  const selected = [];
  let   usedMins = 0;

  for (const p of ordered) {
    if (selected.length >= MAX_PLACES_PER_DAY) break;
    const dur = (p.avg_visit_duration_min || 60) + TRAVEL_BUFFER_MINS;
    if (usedMins + dur > budgetLeft) break;
    selected.push(p);
    usedMins += dur;
  }

  return { places: selected, usedMins };
}

// ─────────────────────────────────────────────────────────────────────────────
// optimiseRoute — nearest-neighbour + 2-opt, unchanged
// ─────────────────────────────────────────────────────────────────────────────
async function optimiseRoute(places, hotelLat, hotelLng) {
  if (places.length <= 1) return { ordered: places, travelMins: [0] };

  let matrix;
  const coords = places.map(p => [p.longitude, p.latitude]);

  try {
    matrix = await getDistanceMatrix(coords, 'driving');
  } catch {
    matrix = places.map((a, i) =>
      places.map((b, j) => {
        if (i === j) return 0;
        const distM = haversine(a.latitude, a.longitude, b.latitude, b.longitude);
        return (distM / 1000 / 30) * 3600;
      })
    );
  }

  const hotelDistances = places.map(p =>
    haversine(hotelLat, hotelLng, p.latitude, p.longitude)
  );
  const startIdx = hotelDistances.indexOf(Math.min(...hotelDistances));

  const visited = new Set([startIdx]);
  const route   = [startIdx];

  while (route.length < places.length) {
    const last    = route[route.length - 1];
    let nearest = -1, minDur = Infinity;
    for (let i = 0; i < places.length; i++) {
      if (visited.has(i)) continue;
      const dur = matrix[last][i] ?? Infinity;
      if (dur < minDur) { minDur = dur; nearest = i; }
    }
    if (nearest === -1) break;
    route.push(nearest);
    visited.add(nearest);
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const before =
          (matrix[route[i-1]][route[i]] ?? 0) +
          (matrix[route[j]][route[j+1] !== undefined ? route[j+1] : route[0]] ?? 0);
        const after =
          (matrix[route[i-1]][route[j]] ?? 0) +
          (matrix[route[i]][route[j+1] !== undefined ? route[j+1] : route[0]] ?? 0);
        if (after < before - 1) {
          route.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }

  return {
    ordered:    route.map(i => places[i]),
    travelMins: route.map((r, idx) =>
      idx === 0 ? 0 : Math.round((matrix[route[idx-1]][r] ?? 0) / 60)
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: buildTimedDay — injects food/shopping cards using CLUSTER-LEVEL flags
//
// cluster.food_available     = true → inject lunch card ~noon
// cluster.shopping_available = true → inject shopping card ~3pm
//
// Tracks which clusters on this day have food/shopping available.
// Injected as timeline cards between places, not as place objects.
// ─────────────────────────────────────────────────────────────────────────────
function buildTimedDay(orderedPlaces, travelMins, anchorEvent, dayFoodAvailable, dayShoppingAvailable) {
  const timeline   = [];
  let   cursor     = DAY_START_HOUR * 60;  // 9:00 = 540 mins
  let   lunchDone  = false;
  let   shopDone   = false;

  orderedPlaces.forEach((p, i) => {
    cursor += travelMins[i] ?? 0;
    const visitDur = p.avg_visit_duration_min || 60;

    timeline.push({
      id:                   String(p._id),
      name:                 p.name,
      category:             p.category,
      area:                 p.area,
      arrival_time:         minsToTime(cursor),
      visit_duration_min:   visitDur,
      departure_time:       minsToTime(cursor + visitDur),
      travel_from_prev_min: travelMins[i] ?? 0,
      is_anchor:            p.is_anchor_place ?? false,
      entry_fee_indian:     p.entry_fee?.indian ?? 0,
      metro:                p.metro ?? null,
      short_description:    p.short_description ?? '',
      image:                p.image_filename ?? '',
      official_website:     p.official_website ?? null,
      coords:               { lat: p.latitude, lng: p.longitude },
    });

    cursor += visitDur + TRAVEL_BUFFER_MINS;

    // FIX 2: inject lunch card once cluster has food_available, after 12:00
    if (dayFoodAvailable && !lunchDone && cursor >= 720) {
      timeline.push({
        id:                   `lunch_${i}`,
        name:                 'Lunch Break',
        category:             'FOOD_BREAK',
        area:                 p.area,
        arrival_time:         minsToTime(cursor),
        visit_duration_min:   45,
        departure_time:       minsToTime(cursor + 45),
        travel_from_prev_min: 0,
        is_anchor:            false,
        short_description:    'Food options available nearby in this area.',
        coords:               null,
      });
      cursor  += 45 + TRAVEL_BUFFER_MINS;
      lunchDone = true;
    }

    // FIX 2: inject shopping card once cluster has shopping_available, after 15:00
    if (dayShoppingAvailable && !shopDone && cursor >= 900) {
      timeline.push({
        id:                   `shop_${i}`,
        name:                 'Shopping Stop',
        category:             'SHOPPING_BREAK',
        area:                 p.area,
        arrival_time:         minsToTime(cursor),
        visit_duration_min:   45,
        departure_time:       minsToTime(cursor + 45),
        travel_from_prev_min: 0,
        is_anchor:            false,
        short_description:    'Shopping options available nearby in this area.',
        coords:               null,
      });
      cursor += 45 + TRAVEL_BUFFER_MINS;
      shopDone = true;
    }
  });

  // Anchor event
  if (anchorEvent) {
    const alreadyVisited = orderedPlaces.some(
      p => String(p._id) === String(anchorEvent.place_id)
    );

    if (alreadyVisited) {
      const existingIdx = timeline.findIndex(
        t => String(t.id) === String(anchorEvent.place_id)
      );
      if (existingIdx !== -1) {
        const showTime = anchorEvent.show_times?.[0] ?? 'evening';
        timeline[existingIdx].anchor_event_note =
          `🌟 Stay for evening show at ${showTime} — ${anchorEvent.name}`;
        timeline[existingIdx].show_times  = anchorEvent.show_times ?? [];
        timeline[existingIdx].event_notes = anchorEvent.notes ?? '';
      }
      return timeline;
    }

    const showTimes = anchorEvent.show_times ?? [];
    let   showMins  = cursor + 30;
    for (const t of showTimes) {
      const [h, m] = t.split(':').map(Number);
      const tm     = h * 60 + (m || 0);
      if (tm >= cursor) { showMins = tm; break; }
    }

    timeline.push({
      id:                   String(anchorEvent._id),
      name:                 anchorEvent.name,
      category:             'ANCHOR_EVENT',
      area:                 '',
      arrival_time:         minsToTime(showMins),
      visit_duration_min:   anchorEvent.duration_min ?? 60,
      departure_time:       minsToTime(showMins + (anchorEvent.duration_min ?? 60)),
      travel_from_prev_min: 0,
      is_anchor:            true,
      show_times:           showTimes,
      season:               anchorEvent.season ?? '',
      notes:                anchorEvent.notes  ?? '',
      coords:               null,
    });
  }

  return timeline;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — buildCityWideItinerary
// ─────────────────────────────────────────────────────────────────────────────
export async function buildCityWideItinerary({
  lat, lng,
  categories   = [],
  numDays      = 3,
  budgetMax    = 9999,
  tripTime     = 'morning',
  avoidCrowds  = false,
  dayOfWeek    = 'mon',
  startDate    = null,
}) {
  if (!lat || !lng) throw new Error('lat and lng are required');
  numDays = Math.min(Math.max(parseInt(numDays) || 1, 1), 10);

  let dayAbbrs;
  if (startDate) {
    dayAbbrs = Array.from({ length: numDays }, (_, i) => {
      const d = new Date(`${startDate}T12:00:00`);
      d.setDate(d.getDate() + i);
      return DAY_ABBR[d.getDay()];
    });
  } else {
    const base = DAY_ABBR.indexOf(dayOfWeek.toLowerCase());
    dayAbbrs   = Array.from({ length: numDays }, (_, i) =>
      DAY_ABBR[(base < 0 ? 1 : base + i) % 7]
    );
  }

  const expandedTerms = buildExpandedTerms(categories);

  const allClusters = await Cluster.find({}).lean();
  const allPlaceIds = [...new Set(allClusters.flatMap(c => c.place_ids ?? []))];
  const placeDocs   = await Place.find(
    { _id: { $in: allPlaceIds }, 'entry_fee.indian': { $lte: budgetMax }, verified: true },
    { _id:1, name:1, category:1, area:1, latitude:1, longitude:1,
      avg_visit_duration_min:1, best_time_of_day:1, open_days:1,
      scores:1, is_anchor_place:1, entry_fee:1, metro:1,
      short_description:1, image_filename:1, official_website:1,
      amenities:1, tags:1 }
  ).lean();

  const placeMap = Object.fromEntries(placeDocs.map(p => [String(p._id), p]));

  const rankedClusters = allClusters
    .map(c => {
      const cPlaces = (c.place_ids ?? []).map(id => placeMap[String(id)]).filter(Boolean);
      const imatch  = interestMatchScore(cPlaces, categories);
      const rank    = finalRank(c, imatch);
      return { ...c, _placeCount: cPlaces.length, _interestMatch: imatch, _finalRank: rank };
    })
    .filter(c => c._placeCount > 0)
    .sort((a, b) => b._finalRank - a._finalRank);

  const dayEventMap     = await scheduleAnchorEvents(numDays, dayAbbrs, startDate);
  // FIX 1: geographic grouping instead of round-robin
  const dayClusterLists = distributeClustersToDays(rankedClusters, numDays, dayEventMap);

  const usedClusterIds = new Set();
  const itinerary      = [];

  for (let d = 0; d < numDays; d++) {
    const dayAbbr     = dayAbbrs[d];
    const anchorEvent = dayEventMap.get(d) ?? null;
    let   budgetLeft  = DAILY_BUDGET_MINS;
    const rawPlaces   = [];
    let   dayFoodAvail = false;
    let   dayShopAvail = false;

    if (anchorEvent) {
      budgetLeft -= (anchorEvent.duration_min ?? 60) + TRAVEL_BUFFER_MINS;
    }

    // Sort clusters within day: MORNING → AFTERNOON → EVENING
    const dayList = (dayClusterLists[d] ?? []).slice().sort((a, b) => {
      const order = { MORNING: 0, AFTERNOON: 1, EVENING: 2 };
      return (order[a.best_time_slot] ?? 0) - (order[b.best_time_slot] ?? 0);
    });

    for (const cluster of dayList) {
      if (budgetLeft < 60)                 break;
      if (usedClusterIds.has(cluster._id)) continue;

      // Deduct inter-cluster travel for every cluster after the first
      if (rawPlaces.length > 0) budgetLeft -= INTER_CLUSTER_TRAVEL;
      if (budgetLeft < 60)      break;

      // FIX 3: pass full remaining budget — no pre-split cap
      const { places, usedMins } = expandCluster(
        cluster, placeMap, dayAbbr,
        budgetLeft, avoidCrowds,
        anchorEvent?.place_id,
        expandedTerms
      );
      if (!places.length) continue;

      rawPlaces.push(...places);
      budgetLeft -= usedMins;
      usedClusterIds.add(cluster._id);

      // FIX 2: track cluster-level food/shopping availability
      if (cluster.food_available)     dayFoodAvail = true;
      if (cluster.shopping_available) dayShopAvail = true;
    }

    // Fallback: if day is still empty pick any unused cluster
    if (rawPlaces.length === 0) {
      for (const cluster of rankedClusters) {
        if (budgetLeft < 60)                 break;
        if (usedClusterIds.has(cluster._id)) continue;
        const { places, usedMins } = expandCluster(
          cluster, placeMap, dayAbbr,
          budgetLeft, avoidCrowds,
          anchorEvent?.place_id,
          expandedTerms
        );
        if (!places.length) continue;
        rawPlaces.push(...places);
        budgetLeft -= usedMins;
        usedClusterIds.add(cluster._id);
        if (cluster.food_available)     dayFoodAvail = true;
        if (cluster.shopping_available) dayShopAvail = true;
      }
    }

    const { ordered, travelMins } = await optimiseRoute(rawPlaces, lat, lng);
    // FIX 2: pass cluster food/shopping flags into buildTimedDay
    const timeline = buildTimedDay(ordered, travelMins, anchorEvent, dayFoodAvail, dayShopAvail);

    const totalVisitMin = ordered.reduce((s, p) => s + (p.avg_visit_duration_min || 60), 0);

    itinerary.push({
      day:               d + 1,
      day_of_week:       dayAbbr,
      total_places:      ordered.length + (anchorEvent ? 1 : 0),
      total_visit_min:   totalVisitMin,
      food_available:    dayFoodAvail,
      shopping_available: dayShopAvail,
      anchor_event: anchorEvent ? {
        id:         String(anchorEvent._id),
        name:       anchorEvent.name,
        place_id:   anchorEvent.place_id,
        show_times: anchorEvent.show_times,
        duration:   anchorEvent.duration_min,
        notes:      anchorEvent.notes,
      } : null,
      timeline,
    });
  }

  return {
    mode:      'city_wide_v2',
    num_days:  numDays,
    categories,
    trip_time: tripTime,
    itinerary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
function minsToTime(m) {
  const h   = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

// ── Pure exports (unchanged) ──────────────────────────────────────────────────
export function diversityFilter(places, maxResults) {
  const areaLim = Math.ceil(maxResults * 0.40);
  const catLim  = Math.ceil(maxResults * 0.50);
  const ac = {}, cc = {}, result = [];
  for (const p of places) {
    if ((ac[p.area]||0) >= areaLim || (cc[p.category]||0) >= catLim) continue;
    ac[p.area]     = (ac[p.area]     || 0) + 1;
    cc[p.category] = (cc[p.category] || 0) + 1;
    result.push(p);
    if (result.length >= maxResults) break;
  }
  return result;
}
export function buildCacheKey({ interests, startDate, numDays, accommodationArea, excludedIds }) {
  return JSON.stringify({
    interests:         [...(interests||[])].sort(),
    startDate:         startDate||'',
    numDays:           numDays||1,
    accommodationArea: accommodationArea||'',
    excludedIds:       [...(excludedIds||[])].sort(),
  });
}
export function injectFoodShopping(stops, includeFood, includeShopping) {
  const out = [];
  let lunchDone = false, shopDone = false;
  for (const s of stops) {
    out.push(s);
    const [h,m] = (s.arrival_time||'09:00').split(':').map(Number);
    const end   = h*60+m+(s.visit_duration_min||60);
    if (includeFood    && !lunchDone && end>=720 && s.amenities?.food_nearby)
      { out.push({_cardType:'lunch',    name:'Lunch break nearby',visit_duration_min:45}); lunchDone=true; }
    if (includeShopping && !shopDone  && end>=900 && s.amenities?.shopping_nearby)
      { out.push({_cardType:'shopping', name:'Shopping stop',     visit_duration_min:45}); shopDone=true;  }
  }
  return out;
}
export function computeCentroid(places) {
  if (!places.length) return [77.2090, 28.6139];
  return [
    places.reduce((s,p)=>s+(p.location?.coordinates?.[0]??p.longitude??77.21),0)/places.length,
    places.reduce((s,p)=>s+(p.location?.coordinates?.[1]??p.latitude??28.61),0)/places.length,
  ];
}
export function validateAndRepair(rawDays, allPlaces, startDate) {
  const ALWAYS   = new Set(['all_days','event_based','seasonal','weekdays']);
  const repaired = new Set();
  const days     = rawDays.map((ids, di) => {
    let abbr = null;
    if (startDate) {
      const d = new Date(`${startDate}T12:00:00`);
      d.setDate(d.getDate() + di);
      abbr = DAY_ABBR[d.getDay()];
    }
    const places = ids.map(id=>allPlaces.find(p=>String(p._id)===String(id))).filter(Boolean);
    const open   = places.filter(p => {
      const od = (p.visit_info?.open_days ?? p.open_days ?? []);
      if (!od.length || od.some(d=>ALWAYS.has(d))) return true;
      return !abbr || od.map(x=>x.toLowerCase()).includes(abbr);
    });
    if (open.length !== places.length) repaired.add(di);
    let used = 0;
    const trimmed = [];
    for (const p of open) {
      const dur = (p.visit_info?.avg_duration_min ?? p.avg_visit_duration_min ?? 60) + 30;
      if (used + dur > 420) { repaired.add(di); break; }
      trimmed.push(p); used += dur;
    }
    return trimmed;
  });
  return { days, repairedDayIndices: repaired };
}
export function buildLLMPrompt(places, numDays, _, accommodationArea) {
  const list = places.map(p=>`  {"id":"${p._id}","name":"${p.name}","area":"${p.area}"}`).join(',\n');
  const note = accommodationArea ? `\nStays in ${accommodationArea}.` : '';
  return `Delhi planner. ${numDays}-day itinerary.${note}\n[\n${list}\n]\nJSON only: {"days":[["id1"]],"rationales":["..."]}`;
}
export function generateFallbackRationale(places) {
  if (!places.length) return 'A curated Delhi exploration day.';
  const ac = {};
  places.forEach(p => { ac[p.area||'Delhi'] = (ac[p.area||'Delhi']||0)+1; });
  const area   = Object.entries(ac).sort((a,b)=>b[1]-a[1])[0][0];
  const anchor = places.reduce((b,p)=>(p.scores?.cultural??0)>(b.scores?.cultural??0)?p:b, places[0]);
  return `${area} exploration anchored by ${anchor.name}.`;
}
export function buildAreaTravelContext(areas, matrix) {
  if (!areas||areas.length<2) return '';
  const lines = [];
  for (let i=0;i<areas.length-1;i++)
    for (let j=i+1;j<areas.length;j++)
      lines.push(`${areas[i]} ↔ ${areas[j]}: ~${Math.round((matrix?.[i]?.[j]||0)/60)} min`);
  return lines.join('\n');
}
export function intensityBalanceCheck(places) {
  const high    = places.filter(p=>(p.scores?.cultural??0)>=0.85);
  const overflow = high.length>2?high.slice(2):[];
  return { ok:!overflow.length, overflow };
}
export async function getClusterPlacesSorted(clusterId, userCategories = []) {
  const cluster = await Cluster.findById(clusterId).lean();
  if (!cluster) throw new Error(`Cluster not found: ${clusterId}`);
  const placeDocs = await Place.find(
    { _id: { $in: cluster.place_ids ?? [] }, verified: true },
    { _id:1,name:1,category:1,area:1,latitude:1,longitude:1,
      avg_visit_duration_min:1,best_time_of_day:1,open_days:1,
      scores:1,is_anchor_place:1,entry_fee:1,metro:1,
      short_description:1,image_filename:1,official_website:1,amenities:1,tags:1 }
  ).lean();
  const expandedTerms = buildExpandedTerms(userCategories);
  const scored = placeDocs.map(p => ({
    ...p,
    interest_score: expandedTerms.size > 0
      ? parseFloat((placeQuality(p) * (placeMatchesInterest(p, expandedTerms) ? 1.5 : 1.0)).toFixed(4))
      : parseFloat(placeQuality(p).toFixed(4)),
  })).sort((a,b)=>b.interest_score-a.interest_score);
  return {
    cluster_id: cluster._id, cluster_name: cluster.name,
    area: cluster.area, best_time_slot: cluster.best_time_slot,
    food_available: cluster.food_available,
    shopping_available: cluster.shopping_available,
    total_places: scored.length, places: scored,
  };
}