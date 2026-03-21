// Server/services/mode2.service.js
// ─────────────────────────────────────────────────────────────────────────────
// Mode 2: "City-Wide" — Algorithmic Clustering & Bin-Packing
// "I'm visiting Delhi for a few days, can you plan my whole trip?"
//
// Algorithm (5 phases):
//   Phase 1 — MongoDB fetch: category + budget + tag filter, compute rank_value
//   Phase 2 — Cluster grouping: group by cluster.id in app layer
//   Phase 3 — Anchor pinning: is_anchor_place locks time slot (Red Fort → evening)
//   Phase 4 — Day distribution: SUM(visit_mins) per day ≤ daily budget
//   Phase 5 — Route ordering: nearest-neighbour on cluster centroids per day
// ─────────────────────────────────────────────────────────────────────────────

import Place from '../models/PlaceSchema.js';
import { haversine, centroid, nearestNeighbourOrder, getTimeSlot, rankValueExpression } from '../utils/geo.js';

const DAILY_BUDGET_MINS = 480;   // 8 hours per day
const CANDIDATE_LIMIT   = 60;    // fetch top N before clustering
const RADIUS_M          = 40000; // 40km — whole city

/**
 * @param {Object}   params
 * @param {number}   params.lat
 * @param {number}   params.lng
 * @param {string[]} params.categories    e.g. ['HERITAGE','RELIGIOUS','FOOD']
 * @param {number}   params.numDays       1–5
 * @param {number}   params.budgetMax     max entry fee INR
 * @param {string}   params.tripTime      'morning'|'afternoon'|'evening' (arrival preference)
 * @param {boolean}  params.avoidCrowds
 * @param {string}   params.dayOfWeek     'mon'|'tue'|...|'sun'
 */
export async function buildCityWideItinerary({
  lat, lng,
  categories = [],
  numDays    = 1,
  budgetMax  = 9999,
  tripTime   = 'morning',
  avoidCrowds = false,
  dayOfWeek  = 'mon',
}) {
  // ── Phase 1: MongoDB fetch ───────────────────────────────────────────────
  const categoryFilter = categories.length
    ? { $or: [{ category: { $in: categories } }, { tags: { $in: categories.map(c => c.toLowerCase()) } }] }
    : {};

  const candidates = await Place.aggregate([
    {
      $geoNear: {
        near:          { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'dist_m',
        maxDistance:   RADIUS_M,
        spherical:     true,
        query: {
          'entry_fee.indian': { $lte: budgetMax },
          is_sub_place:       { $ne: true },
          ...categoryFilter,
        },
      },
    },
    {
      $addFields: {
        ...rankValueExpression({ categories, radiusM: RADIUS_M, userLng: lng, userLat: lat, timeSlot: tripTime, avoidCrowds }),
      },
    },
    { $sort:  { rank_value: -1 } },
    { $limit: CANDIDATE_LIMIT },
  ]);

  // ── Phase 2: group into cluster blocks ───────────────────────────────────
  const clusterMap  = {};
  const standalones = [];

  for (const p of candidates) {
    if (!p.cluster?.id) {
      standalones.push(p);
    } else {
      if (!clusterMap[p.cluster.id]) clusterMap[p.cluster.id] = [];
      clusterMap[p.cluster.id].push(p);
    }
  }

  // Build block objects — sort places inside each block by visit_order
  const blocks = [];
  for (const [cid, places] of Object.entries(clusterMap)) {
    places.sort((a, b) => (a.cluster?.visit_order ?? 99) - (b.cluster?.visit_order ?? 99));
    const hasAnchor  = places.some(p => p.is_anchor_place);
    const blockScore = places.reduce((s, p) => s + p.rank_value, 0) / places.length;
    const totalMins  = places.reduce((s, p) => s + (p.avg_visit_duration_min || 60), 0);
    const c          = centroid(places);

    if (places.length === 1) {
      // cluster collapsed to 1 after filter — treat as standalone
      standalones.push({ ...places[0], _wasCluster: true });
    } else {
      blocks.push({ type: 'cluster', cluster_id: cid, places, hasAnchor, blockScore, totalMins, centroid: c });
    }
  }

  // Sort: anchor blocks first, then by score desc
  blocks.sort((a, b) => (b.hasAnchor - a.hasAnchor) || (b.blockScore - a.blockScore));
  standalones.sort((a, b) => b.rank_value - a.rank_value);

  const allUnits = [...blocks, ...standalones.map(p => ({ 
      type: 'single', 
      place: p, 
      blockScore: p.rank_value, 
      totalMins: p.avg_visit_duration_min || 60, 
      centroid: { lat: p.latitude, lng: p.longitude } 
  }))];

  // ── Phase 3+4: anchor pinning + distribute across days ───────────────────
  const days = Array.from({ length: numDays }, () => ({
    morning: [], afternoon: [], evening: [], usedMins: 0,
  }));

  for (const unit of allUnits) {
    const mins   = unit.totalMins;
    const places = unit.type === 'cluster' ? unit.places : [unit.place];

    // Pick day with most remaining budget (greedy bin-packing)
    const day = days
      .filter(d => d.usedMins + mins <= DAILY_BUDGET_MINS)
      .sort((a, b) => b.usedMins - a.usedMins)[0];   // most-filled day that still fits

    if (!day) continue; // doesn't fit anywhere — skip

    // Determine time slot
    let slot = tripTime;
    if (unit.hasAnchor || (unit.type === 'single' && unit.place.is_anchor_place)) {
      const anchor = places.find(p => p.is_anchor_place) ?? places[0];
      const times  = anchor.best_time_of_day ?? [];
      slot = times.includes('evening') ? 'evening'
           : times.includes('morning') ? 'morning'
           : 'afternoon';
    } else {
      // Pick least-full slot
      const slotLoads = { morning: day.morning.length, afternoon: day.afternoon.length, evening: day.evening.length };
      slot = Object.entries(slotLoads).sort((a, b) => a[1] - b[1])[0][0];
    }

    day[slot].push(unit);
    day.usedMins += mins;
  }

  // ── Phase 5: nearest-neighbour ordering within each day's slots ──────────
  const result = days.map((day, i) => {
    const orderedMorning   = nearestNeighbourOrder(day.morning,   lat, lng);
    const orderedAfternoon = nearestNeighbourOrder(day.afternoon, lat, lng);
    const orderedEvening   = nearestNeighbourOrder(day.evening,   lat, lng);

    return {
      day: i + 1,
      total_places: countPlaces(orderedMorning) + countPlaces(orderedAfternoon) + countPlaces(orderedEvening),
      total_mins:   day.usedMins,
      morning:      formatSlot(orderedMorning),
      afternoon:    formatSlot(orderedAfternoon),
      evening:      formatSlot(orderedEvening),
    };
  });

  return {
    mode:       'city_wide',
    num_days:   numDays,
    categories,
    trip_time:  tripTime,
    itinerary:  result,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countPlaces(units) {
  return units.reduce((s, u) => s + (u.type === 'cluster' ? u.places.length : 1), 0);
}

function formatSlot(units) {
  return units.map(unit => {
    if (unit.type === 'cluster') {
      return {
        type:       'cluster',
        cluster_id: unit.cluster_id,
        total_mins: unit.totalMins,
        places:     unit.places.map(formatPlaceCompact),
      };
    }
    return {
      type:  'single',
      place: formatPlaceCompact(unit.place),
    };
  });
}

function formatPlaceCompact(p) {
  return {
    id:                 p._id,
    name:               p.name,
    category:           p.category,
    area:               p.area,
    visit_duration_min: p.avg_visit_duration_min,
    best_time_of_day:   p.best_time_of_day,
    is_anchor:          p.is_anchor_place,
    anchor_event:       p.anchor_event_details || null,
    entry_fee_indian:   p.entry_fee?.indian ?? 0,
    metro:              p.metro,
    short_description:  p.short_description,
    image:              p.image_filename,
    official_website:   p.official_website || null,
    coords:             { lat: p.latitude, lng: p.longitude },
    rank_value:         p.rank_value ? Math.round(p.rank_value * 1000) / 1000 : null,
  };
}
