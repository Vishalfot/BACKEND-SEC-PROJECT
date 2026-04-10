// // Server/services/mode2.service.js
// // ─────────────────────────────────────────────────────────────────────────────
// // Mode 2: "City-Wide" — Algorithmic Clustering & Bin-Packing
// // "I'm visiting Delhi for a few days, can you plan my whole trip?"
// //
// // Algorithm (5 phases):
// //   Phase 1 — MongoDB fetch: category + budget + tag filter, compute rank_value
// //   Phase 2 — Cluster grouping: group by cluster.id in app layer
// //   Phase 3 — Anchor pinning: is_anchor_place locks time slot (Red Fort → evening)
// //   Phase 4 — Day distribution: SUM(visit_mins) per day ≤ daily budget
// //   Phase 5 — Route ordering: nearest-neighbour on cluster centroids per day
// // ─────────────────────────────────────────────────────────────────────────────

// import Place from '../models/PlaceSchema.js';
// import { haversine, centroid, nearestNeighbourOrder, getTimeSlot, rankValueExpression } from '../utils/geo.js';

// const DAILY_BUDGET_MINS = 480;   // 8 hours per day
// const CANDIDATE_LIMIT   = 60;    // fetch top N before clustering
// const RADIUS_M          = 40000; // 40km — whole city

// /**
//  * @param {Object}   params
//  * @param {number}   params.lat
//  * @param {number}   params.lng
//  * @param {string[]} params.categories    e.g. ['HERITAGE','RELIGIOUS','FOOD']
//  * @param {number}   params.numDays       1–5
//  * @param {number}   params.budgetMax     max entry fee INR
//  * @param {string}   params.tripTime      'morning'|'afternoon'|'evening' (arrival preference)
//  * @param {boolean}  params.avoidCrowds
//  * @param {string}   params.dayOfWeek     'mon'|'tue'|...|'sun'
//  */
// export async function buildCityWideItinerary({
//   lat, lng,
//   categories = [],
//   numDays    = 1,
//   budgetMax  = 9999,
//   tripTime   = 'morning',
//   avoidCrowds = false,
//   dayOfWeek  = 'mon',
// }) {
//   // ── Phase 1: MongoDB fetch ───────────────────────────────────────────────
//   const categoryFilter = categories.length
//     ? { $or: [{ category: { $in: categories } }, { tags: { $in: categories.map(c => c.toLowerCase()) } }] }
//     : {};

//   const candidates = await Place.aggregate([
//     {
//       $geoNear: {
//         near:          { type: 'Point', coordinates: [lng, lat] },
//         distanceField: 'dist_m',
//         maxDistance:   RADIUS_M,
//         spherical:     true,
//         query: {
//           'entry_fee.indian': { $lte: budgetMax },
//           is_sub_place:       { $ne: true },
//           ...categoryFilter,
//         },
//       },
//     },
//     {
//       $addFields: {
//         ...rankValueExpression({ categories, radiusM: RADIUS_M, userLng: lng, userLat: lat, timeSlot: tripTime, avoidCrowds }),
//       },
//     },
//     { $sort:  { rank_value: -1 } },
//     { $limit: CANDIDATE_LIMIT },
//   ]);

//   // ── Phase 2: group into cluster blocks ───────────────────────────────────
//   const clusterMap  = {};
//   const standalones = [];

//   for (const p of candidates) {
//     if (!p.cluster?.id) {
//       standalones.push(p);
//     } else {
//       if (!clusterMap[p.cluster.id]) clusterMap[p.cluster.id] = [];
//       clusterMap[p.cluster.id].push(p);
//     }
//   }

//   // Build block objects — sort places inside each block by visit_order
//   const blocks = [];
//   for (const [cid, places] of Object.entries(clusterMap)) {
//     places.sort((a, b) => (a.cluster?.visit_order ?? 99) - (b.cluster?.visit_order ?? 99));
//     const hasAnchor  = places.some(p => p.is_anchor_place);
//     const blockScore = places.reduce((s, p) => s + p.rank_value, 0) / places.length;
//     const totalMins  = places.reduce((s, p) => s + (p.avg_visit_duration_min || 60), 0);
//     const c          = centroid(places);

//     if (places.length === 1) {
//       // cluster collapsed to 1 after filter — treat as standalone
//       standalones.push({ ...places[0], _wasCluster: true });
//     } else {
//       blocks.push({ type: 'cluster', cluster_id: cid, places, hasAnchor, blockScore, totalMins, centroid: c });
//     }
//   }

//   // Sort: anchor blocks first, then by score desc
//   blocks.sort((a, b) => (b.hasAnchor - a.hasAnchor) || (b.blockScore - a.blockScore));
//   standalones.sort((a, b) => b.rank_value - a.rank_value);

//   const allUnits = [...blocks, ...standalones.map(p => ({ 
//       type: 'single', 
//       place: p, 
//       blockScore: p.rank_value, 
//       totalMins: p.avg_visit_duration_min || 60, 
//       centroid: { lat: p.latitude, lng: p.longitude } 
//   }))];

//   // ── Phase 3+4: anchor pinning + distribute across days ───────────────────
//   const days = Array.from({ length: numDays }, () => ({
//     morning: [], afternoon: [], evening: [], usedMins: 0,
//   }));

//   for (const unit of allUnits) {
//     const mins   = unit.totalMins;
//     const places = unit.type === 'cluster' ? unit.places : [unit.place];

//     // Pick day with most remaining budget (greedy bin-packing)
//     const day = days
//       .filter(d => d.usedMins + mins <= DAILY_BUDGET_MINS)
//       .sort((a, b) => b.usedMins - a.usedMins)[0];   // most-filled day that still fits

//     if (!day) continue; // doesn't fit anywhere — skip

//     // Determine time slot
//     let slot = tripTime;
//     if (unit.hasAnchor || (unit.type === 'single' && unit.place.is_anchor_place)) {
//       const anchor = places.find(p => p.is_anchor_place) ?? places[0];
//       const times  = anchor.best_time_of_day ?? [];
//       slot = times.includes('evening') ? 'evening'
//            : times.includes('morning') ? 'morning'
//            : 'afternoon';
//     } else {
//       // Pick least-full slot
//       const slotLoads = { morning: day.morning.length, afternoon: day.afternoon.length, evening: day.evening.length };
//       slot = Object.entries(slotLoads).sort((a, b) => a[1] - b[1])[0][0];
//     }

//     day[slot].push(unit);
//     day.usedMins += mins;
//   }

//   // ── Phase 5: nearest-neighbour ordering within each day's slots ──────────
//   const result = days.map((day, i) => {
//     const orderedMorning   = nearestNeighbourOrder(day.morning,   lat, lng);
//     const orderedAfternoon = nearestNeighbourOrder(day.afternoon, lat, lng);
//     const orderedEvening   = nearestNeighbourOrder(day.evening,   lat, lng);

//     return {
//       day: i + 1,
//       total_places: countPlaces(orderedMorning) + countPlaces(orderedAfternoon) + countPlaces(orderedEvening),
//       total_mins:   day.usedMins,
//       morning:      formatSlot(orderedMorning),
//       afternoon:    formatSlot(orderedAfternoon),
//       evening:      formatSlot(orderedEvening),
//     };
//   });

//   return {
//     mode:       'city_wide',
//     num_days:   numDays,
//     categories,
//     trip_time:  tripTime,
//     itinerary:  result,
//   };
// }

// // ── Helpers ───────────────────────────────────────────────────────────────────

// function countPlaces(units) {
//   return units.reduce((s, u) => s + (u.type === 'cluster' ? u.places.length : 1), 0);
// }

// function formatSlot(units) {
//   return units.map(unit => {
//     if (unit.type === 'cluster') {
//       return {
//         type:       'cluster',
//         cluster_id: unit.cluster_id,
//         total_mins: unit.totalMins,
//         places:     unit.places.map(formatPlaceCompact),
//       };
//     }
//     return {
//       type:  'single',
//       place: formatPlaceCompact(unit.place),
//     };
//   });
// }

// function formatPlaceCompact(p) {
//   return {
//     id:                 p._id,
//     name:               p.name,
//     category:           p.category,
//     area:               p.area,
//     visit_duration_min: p.avg_visit_duration_min,
//     best_time_of_day:   p.best_time_of_day,
//     is_anchor:          p.is_anchor_place,
//     anchor_event:       p.anchor_event_details || null,
//     entry_fee_indian:   p.entry_fee?.indian ?? 0,
//     metro:              p.metro,
//     short_description:  p.short_description,
//     image:              p.image_filename,
//     official_website:   p.official_website || null,
//     coords:             { lat: p.latitude, lng: p.longitude },
//     rank_value:         p.rank_value ? Math.round(p.rank_value * 1000) / 1000 : null,
//   };
// }

/**
 * services/mode2.service.js  — v2 (Excel-Cluster Pipeline)
 *
 * REPLACES services/mode2.service.js entirely.
 *
 * IMPROVEMENTS over old version:
 *  1. Full ranking formula (cultural, popularity, anchor, accessibility,
 *     crowd comfort, interest match — all weighted correctly)
 *  2. InterestMatch is weighted by place quality, not just category hit
 *  3. Day-quality distribution (high-rank clusters spread across days,
 *     not all dumped into Day 1)
 *  4. OSRM real travel times replace straight-line haversine guesses
 *  5. Hotel/start location awareness — each day ends closest to hotel
 *  6. Anchor events scheduled FIRST, highest priority wins per day
 *  7. open_days validated per specific day of the week
 *  8. Timed schedule with arrival + departure times from 09:00
 *
 * ─── Ranking Formulas ────────────────────────────────────────────────────────
 *
 *  InterestMatch(cluster) =
 *    Σ over places in cluster of:
 *      UserInterestWeight(place)
 *      × CategoryMatch(place, userCategories)         ← 1.0 or 0
 *      × (0.6 × cultural_score + 0.4 × popularity_score)
 *    divided by cluster place count  → normalised 0–1
 *
 *  BaseClusterRank (pre-computed, stored in MongoDB) =
 *    cultural    × 0.20
 *  + popularity  × 0.15
 *  + anchor      × 0.15
 *  + accessibility × 0.10
 *  + crowd_comfort × 0.10
 *  normalised to 0–1 range (raw max = 0.70)
 *
 *  FinalClusterRank (live, per request) =
 *    BaseClusterRank × 0.60 + InterestMatch × 0.40
 */

// import Place       from '../models/PlaceSchema.js';
// import Cluster     from '../models/Cluster.js';
// import AnchorEvent from '../models/AnchorEvent.js';
// import { getDistanceMatrix } from './osrm.service.js';
// import { haversine }         from '../utils/geo.js';

// // ── Constants ─────────────────────────────────────────────────────────────────
// const DAILY_BUDGET_MINS  = 480;   // 8 hours
// const DAY_START_HOUR     = 9;
// const TRAVEL_BUFFER_MINS = 15;    // buffer between stops
// const MAX_PLACES_PER_DAY = 6;
// const DAY_ABBR = ['sun','mon','tue','wed','thu','fri','sat'];

// // User interest category → relevant Place categories & tags
// // Lets the user pick broad interests that map to your actual category enum
// const INTEREST_CATEGORY_MAP = {
//   HERITAGE:      ['HERITAGE','CULTURAL','MUSEUM','EXHIBITION'],
//   RELIGIOUS:     ['RELIGIOUS'],
//   SHOPPING:      ['SHOPPING'],
//   FOOD:          ['FOOD'],
//   NATURE:        ['PARK','NATURE','WILDLIFE'],
//   ENTERTAINMENT: ['ENTERTAINMENT','NIGHTLIFE','ACTIVITY'],
//   MODERN:        ['MODERN','EDUCATIONAL'],
//   SPORTS:        ['SPORTS'],
//   WELLNESS:      ['WELLNESS'],
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // InterestMatch(cluster)
// // Weighted by place quality so a category match on Qutub Minar (0.95)
// // counts more than a match on a minor museum (0.60).
// // ─────────────────────────────────────────────────────────────────────────────
// function interestMatchScore(clusterPlaces, userCategories) {
//   if (!userCategories.length || !clusterPlaces.length) return 0.5;

//   // Expand user categories through the map
//   const expandedCats = new Set(
//     userCategories.flatMap(c => INTEREST_CATEGORY_MAP[c.toUpperCase()] ?? [c.toUpperCase()])
//   );
//   // Also match raw tags e.g. "heritage", "photography"
//   const tagTerms = userCategories.map(c => c.toLowerCase());

//   let weightedSum   = 0;
//   let totalWeight   = 0;

//   for (const p of clusterPlaces) {
//     // quality weight for this place
//     const quality = 0.6 * (p.scores?.cultural ?? 0) + 0.4 * (p.scores?.popularity ?? 0);
//     totalWeight += quality;

//     // does this place match any user interest?
//     const catMatch = expandedCats.has(p.category?.toUpperCase());
//     const tagMatch = (p.tags ?? []).some(t => tagTerms.includes(t.toLowerCase()));

//     if (catMatch || tagMatch) {
//       weightedSum += quality;
//     }
//   }

//   return totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(4)) : 0.5;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // FinalClusterRank = BaseRank × 0.60 + InterestMatch × 0.40
// // ─────────────────────────────────────────────────────────────────────────────
// function finalRank(cluster, interestMatch) {
//   return parseFloat(
//     ((cluster.base_rank_score ?? 0.5) * 0.60 + interestMatch * 0.40).toFixed(4)
//   );
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // B3 — Schedule AnchorEvents first, one per day, highest priority wins
// // Returns Map<dayIndex → AnchorEvent doc>
// // ─────────────────────────────────────────────────────────────────────────────
// async function scheduleAnchorEvents(numDays, dayAbbrs) {
//   const events = await AnchorEvent.find({})
//     .sort({ priority_weight: -1 })
//     .lean();

//   const dayEventMap  = new Map();
//   const usedEventIds = new Set();

//   for (let d = 0; d < numDays; d++) {
//     const today = dayAbbrs[d].toLowerCase();

//     for (const ev of events) {
//       if (usedEventIds.has(ev._id)) continue;

//       const days    = (ev.available_days ?? []).map(x => x.toLowerCase().trim());
//       const runsToday = !days.length || days.includes(today) || days.includes('all_days');
//       if (!runsToday) continue;

//       dayEventMap.set(d, ev);
//       usedEventIds.add(ev._id);
//       break;
//     }
//   }
//   return dayEventMap;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // Day-quality distribution
// // Instead of dumping top clusters into Day 1, interleave them so every
// // day has roughly balanced quality. Strategy: round-robin assignment
// // by rank — rank-1 cluster → Day 0, rank-2 → Day 1, rank-3 → Day 2,
// // rank-4 → Day 0 again, etc. Each day then has one "headliner" cluster
// // and fills remaining time with closest unused clusters.
// // ─────────────────────────────────────────────────────────────────────────────
// function distributeClustersToDays(rankedClusters, numDays, dayEventMap) {
//   // Anchor-event clusters are already pre-assigned — keep them pinned
//   const anchorClusters = new Map();   // dayIndex → clusterId
//   for (const [dayIdx, ev] of dayEventMap.entries()) {
//     const ec = rankedClusters.find(c => (c.place_ids ?? []).includes(ev.place_id));
//     if (ec) anchorClusters.set(dayIdx, ec._id);
//   }

//   // Remove anchor clusters from the pool before round-robining
//   const pool = rankedClusters.filter(
//     c => ![...anchorClusters.values()].includes(c._id)
//   );

//   // Build per-day headliner list: anchor cluster first if exists, then round-robin
//   const dayHeadliners = Array.from({ length: numDays }, (_, d) => {
//     const ac = anchorClusters.get(d);
//     return ac ? [rankedClusters.find(c => c._id === ac)] : [];
//   });

//   pool.forEach((cluster, idx) => {
//     dayHeadliners[idx % numDays].push(cluster);
//   });

//   return dayHeadliners;  // dayHeadliners[d] = ordered cluster list for day d
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // Expand cluster → Place objects for one day
// // Respects open_days and daily budget
// // ─────────────────────────────────────────────────────────────────────────────
// function expandCluster(cluster, placeMap, dayAbbr, budgetLeft, avoidCrowds) {
//   // const candidates = (cluster.place_ids ?? [])
//   //   .map(id => placeMap[String(id)])
//   //   .filter(Boolean)
//   //   .filter(p => {
//   //     const od = (p.open_days ?? []).map(d => d.toLowerCase());
//   //     return !od.length
//   //       || od.includes('all_days')
//   //       || od.includes('event_based')
//   //       || od.includes(dayAbbr.toLowerCase());
//   //   });
//   const candidates = (cluster.place_ids ?? [])
//     .map(id => placeMap[String(id)])
//     .filter(Boolean)
//     .filter(p => {
//       // Skip the anchor event place — it will appear as evening event card
//       if (anchorEventPlaceId && String(p._id) === String(anchorEventPlaceId)) return false;
      
//       const od = (p.open_days ?? []).map(d => d.toLowerCase());
//       return !od.length
//         || od.includes('all_days')
//         || od.includes('event_based')
//         || od.includes(dayAbbr.toLowerCase());
//     });

//   // Main anchor place first; then sort by cultural or inverse popularity
//   candidates.sort((a, b) => {
//     const aMain = String(a._id) === cluster.main_anchor_place_id ? 1 : 0;
//     const bMain = String(b._id) === cluster.main_anchor_place_id ? 1 : 0;
//     if (aMain !== bMain) return bMain - aMain;
//     return avoidCrowds
//       ? (a.scores?.popularity ?? 0) - (b.scores?.popularity ?? 0)   // low pop first
//       : (b.scores?.cultural  ?? 0) - (a.scores?.cultural  ?? 0);    // high cult first
//   });

//   const selected = [];
//   let   usedMins = 0;

//   for (const p of candidates) {
//     if (selected.length >= MAX_PLACES_PER_DAY) break;
//     const dur = (p.avg_visit_duration_min || 60) + TRAVEL_BUFFER_MINS;
//     if (usedMins + dur > budgetLeft) break;
//     selected.push(p);
//     usedMins += dur;
//   }

//   return { places: selected, usedMins };
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // Route optimisation using OSRM real travel times (2-opt)
// // Falls back to nearest-neighbour haversine if OSRM is unavailable
// // ─────────────────────────────────────────────────────────────────────────────
// async function optimiseRoute(places, hotelLat, hotelLng) {
//   if (places.length <= 1) return { ordered: places, travelMins: [0] };

//   let matrix;
//   const coords = places.map(p => [p.longitude, p.latitude]);

//   try {
//     // OSRM returns durations in seconds
//     const raw = await getDistanceMatrix(coords, 'driving');
//     matrix = raw;
//   } catch {
//     // Fallback: haversine at ~30 km/h average Delhi speed
//     matrix = places.map((a, i) =>
//       places.map((b, j) => {
//         if (i === j) return 0;
//         const distM = haversine(a.latitude, a.longitude, b.latitude, b.longitude);
//         return (distM / 1000 / 30) * 3600;  // seconds at 30 km/h
//       })
//     );
//   }

//   // Nearest-neighbour starting from hotel
//   const hotelDistances = places.map(p =>
//     haversine(hotelLat, hotelLng, p.latitude, p.longitude)
//   );
//   const startIdx = hotelDistances.indexOf(Math.min(...hotelDistances));

//   const visited = new Set([startIdx]);
//   const route   = [startIdx];

//   while (route.length < places.length) {
//     const last    = route[route.length - 1];
//     let   nearest = -1, minDur = Infinity;
//     for (let i = 0; i < places.length; i++) {
//       if (visited.has(i)) continue;
//       const dur = matrix[last][i] ?? Infinity;
//       if (dur < minDur) { minDur = dur; nearest = i; }
//     }
//     if (nearest === -1) break;
//     route.push(nearest);
//     visited.add(nearest);
//   }

//   // 2-opt improvement
//   let improved = true;
//   while (improved) {
//     improved = false;
//     for (let i = 1; i < route.length - 1; i++) {
//       for (let j = i + 1; j < route.length; j++) {
//         const before =
//           (matrix[route[i - 1]][route[i]] ?? 0) +
//           (matrix[route[j]][route[j + 1] !== undefined ? route[j + 1] : route[0]] ?? 0);
//         const after =
//           (matrix[route[i - 1]][route[j]] ?? 0) +
//           (matrix[route[i]][route[j + 1] !== undefined ? route[j + 1] : route[0]] ?? 0);
//         if (after < before - 1) {
//           route.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse());
//           improved = true;
//         }
//       }
//     }
//   }

//   const ordered    = route.map(i => places[i]);
//   const travelMins = route.map((r, idx) => {
//     if (idx === 0) return 0;
//     return Math.round((matrix[route[idx - 1]][r] ?? 0) / 60);
//   });

//   return { ordered, travelMins };
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // Build timed schedule for one day
// // ─────────────────────────────────────────────────────────────────────────────
// function buildTimedDay(orderedPlaces, travelMins, anchorEvent) {
//   const timeline = [];
//   let   cursor   = DAY_START_HOUR * 60;

//   orderedPlaces.forEach((p, i) => {
//     cursor += travelMins[i] ?? 0;
//     const visitDur = p.avg_visit_duration_min || 60;

//     timeline.push({
//       id:                  String(p._id),
//       name:                p.name,
//       category:            p.category,
//       area:                p.area,
//       arrival_time:        minsToTime(cursor),
//       visit_duration_min:  visitDur,
//       departure_time:      minsToTime(cursor + visitDur),
//       travel_from_prev_min: travelMins[i] ?? 0,
//       is_anchor:           p.is_anchor_place ?? false,
//       entry_fee_indian:    p.entry_fee?.indian ?? 0,
//       metro:               p.metro ?? null,
//       short_description:   p.short_description ?? '',
//       image:               p.image_filename ?? '',
//       official_website:    p.official_website ?? null,
//       coords:              { lat: p.latitude, lng: p.longitude },
//     });

//     cursor += visitDur + TRAVEL_BUFFER_MINS;
//   });

//   // Anchor event appended at end — pick first show time that fits
//   if (anchorEvent) {
//     const showTimes = anchorEvent.show_times ?? [];
//     let showMins = cursor + 30;
//     for (const t of showTimes) {
//       const [h, m] = t.split(':').map(Number);
//       const tm     = h * 60 + (m || 0);
//       if (tm >= cursor) { showMins = tm; break; }
//     }

//     timeline.push({
//       id:                   String(anchorEvent._id),
//       name:                 anchorEvent.name,
//       category:             'ANCHOR_EVENT',
//       area:                 '',
//       arrival_time:         minsToTime(showMins),
//       visit_duration_min:   anchorEvent.duration_min ?? 60,
//       departure_time:       minsToTime(showMins + (anchorEvent.duration_min ?? 60)),
//       travel_from_prev_min: 0,
//       is_anchor:            true,
//       show_times:           showTimes,
//       season:               anchorEvent.season ?? '',
//       notes:                anchorEvent.notes  ?? '',
//       coords:               null,
//     });
//   }

//   return timeline;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // MAIN EXPORT
// // ─────────────────────────────────────────────────────────────────────────────
// /**
//  * @param {number}   params.lat         - Hotel / starting point lat
//  * @param {number}   params.lng         - Hotel / starting point lng
//  * @param {string[]} params.categories  - e.g. ['HERITAGE','RELIGIOUS','FOOD']
//  * @param {number}   params.numDays
//  * @param {number}   params.budgetMax   - max entry fee INR
//  * @param {string}   params.tripTime    - 'morning' | 'afternoon' | 'evening'
//  * @param {boolean}  params.avoidCrowds
//  * @param {string}   params.dayOfWeek   - first day abbr 'mon'–'sun'
//  * @param {string}   [params.startDate] - ISO "2026-04-14" (preferred over dayOfWeek)
//  */
// export async function buildCityWideItinerary({
//   lat, lng,
//   categories   = [],
//   numDays      = 3,
//   budgetMax    = 9999,
//   tripTime     = 'morning',
//   avoidCrowds  = false,
//   dayOfWeek    = 'mon',
//   startDate    = null,
// }) {
//   // ── B1 Validate ─────────────────────────────────────────────────────────────
//   if (!lat || !lng) throw new Error('lat and lng are required');
//   numDays = Math.min(Math.max(parseInt(numDays) || 1, 1), 10);

//   // Build ordered day abbreviations for the trip duration
//   let dayAbbrs;
//   if (startDate) {
//     dayAbbrs = Array.from({ length: numDays }, (_, i) => {
//       const d = new Date(`${startDate}T12:00:00`);
//       d.setDate(d.getDate() + i);
//       return DAY_ABBR[d.getDay()];
//     });
//   } else {
//     const base = DAY_ABBR.indexOf(dayOfWeek.toLowerCase());
//     dayAbbrs   = Array.from({ length: numDays }, (_, i) => DAY_ABBR[(base < 0 ? 1 : base + i) % 7]);
//   }

//   // ── B2 Fetch clusters + places ───────────────────────────────────────────────
//   const allClusters = await Cluster.find({}).lean();

//   const allPlaceIds = [...new Set(allClusters.flatMap(c => c.place_ids ?? []))];
//   const placeDocs   = await Place.find(
//     { _id: { $in: allPlaceIds }, 'entry_fee.indian': { $lte: budgetMax }, verified: true },
//     { _id:1, name:1, category:1, area:1, latitude:1, longitude:1,
//       avg_visit_duration_min:1, best_time_of_day:1, open_days:1,
//       scores:1, is_anchor_place:1, entry_fee:1, metro:1,
//       short_description:1, image_filename:1, official_website:1,
//       amenities:1, tags:1 }
//   ).lean();

//   const placeMap = Object.fromEntries(placeDocs.map(p => [String(p._id), p]));

//   // ── Compute InterestMatch and FinalRank for every cluster ───────────────────
//   const rankedClusters = allClusters
//     .map(c => {
//       const cPlaces      = (c.place_ids ?? []).map(id => placeMap[String(id)]).filter(Boolean);
//       const imatch       = interestMatchScore(cPlaces, categories);
//       const rank         = finalRank(c, imatch);
//       return { ...c, _placeCount: cPlaces.length, _interestMatch: imatch, _finalRank: rank };
//     })
//     .filter(c => c._placeCount > 0)
//     .sort((a, b) => b._finalRank - a._finalRank);

//   // ── B3 Schedule anchor events ────────────────────────────────────────────────
//   const dayEventMap = await scheduleAnchorEvents(numDays, dayAbbrs);

//   // ── Day-quality distribution ─────────────────────────────────────────────────
//   const dayClusterLists = distributeClustersToDays(rankedClusters, numDays, dayEventMap);

//   // ── B4+B5 Build each day ─────────────────────────────────────────────────────
//   const usedClusterIds = new Set();
//   const itinerary      = [];

//   for (let d = 0; d < numDays; d++) {
//     const dayAbbr     = dayAbbrs[d];
//     const anchorEvent = dayEventMap.get(d) ?? null;
//     let   budgetLeft  = DAILY_BUDGET_MINS;
//     const rawPlaces   = [];

//     if (anchorEvent) {
//       budgetLeft -= (anchorEvent.duration_min ?? 60) + TRAVEL_BUFFER_MINS;
//     }

//     // Use pre-distributed cluster order for this day
//     for (const cluster of (dayClusterLists[d] ?? [])) {
//       if (budgetLeft < 60)                 break;
//       if (usedClusterIds.has(cluster._id)) continue;

//       const { places, usedMins } = expandCluster(
//         cluster, placeMap, dayAbbr, budgetLeft, avoidCrowds
//       );
//       if (!places.length) continue;

//       rawPlaces.push(...places);
//       budgetLeft -= usedMins;
//       usedClusterIds.add(cluster._id);
//     }

//     // Fallback: if pre-distributed list ran out, pull from remaining ranked clusters
//     if (rawPlaces.length === 0) {
//       for (const cluster of rankedClusters) {
//         if (budgetLeft < 60)                 break;
//         if (usedClusterIds.has(cluster._id)) continue;
//         const { places, usedMins } = expandCluster(
//           cluster, placeMap, dayAbbr, budgetLeft, avoidCrowds
//         );
//         if (!places.length) continue;
//         rawPlaces.push(...places);
//         budgetLeft -= usedMins;
//         usedClusterIds.add(cluster._id);
//       }
//     }

//     // ── B7 OSRM route optimisation ────────────────────────────────────────────
//     const { ordered, travelMins } = await optimiseRoute(rawPlaces, lat, lng);

//     // ── B8 Timed schedule ─────────────────────────────────────────────────────
//     const timeline = buildTimedDay(ordered, travelMins, anchorEvent);
//     const totalVisitMin = ordered.reduce((s, p) => s + (p.avg_visit_duration_min || 60), 0);

//     itinerary.push({
//       day:             d + 1,
//       day_of_week:     dayAbbr,
//       total_places:    ordered.length + (anchorEvent ? 1 : 0),
//       total_visit_min: totalVisitMin,
//       anchor_event: anchorEvent ? {
//         id:         String(anchorEvent._id),
//         name:       anchorEvent.name,
//         place_id:   anchorEvent.place_id,
//         show_times: anchorEvent.show_times,
//         duration:   anchorEvent.duration_min,
//         notes:      anchorEvent.notes,
//       } : null,
//       timeline,
//     });
//   }

//   return {
//     mode:       'city_wide_v2',
//     num_days:   numDays,
//     categories,
//     trip_time:  tripTime,
//     itinerary,
//   };
// }

// // ── Helpers ───────────────────────────────────────────────────────────────────
// function minsToTime(m) {
//   const h = Math.floor(m / 60) % 24;
//   const min = m % 60;
//   return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
// }

// // ── Pure exports for testMode2.js compatibility ───────────────────────────────
// export function diversityFilter(places, maxResults) {
//   const areaLim = Math.ceil(maxResults * 0.40);
//   const catLim  = Math.ceil(maxResults * 0.50);
//   const ac = {}, cc = {}, result = [];
//   for (const p of places) {
//     if ((ac[p.area]||0) >= areaLim || (cc[p.category]||0) >= catLim) continue;
//     ac[p.area]     = (ac[p.area]     || 0) + 1;
//     cc[p.category] = (cc[p.category] || 0) + 1;
//     result.push(p);
//     if (result.length >= maxResults) break;
//   }
//   return result;
// }
// export function buildAreaTravelContext(areas, matrix) {
//   if (!areas || areas.length < 2) return '';
//   const lines = [];
//   for (let i = 0; i < areas.length - 1; i++)
//     for (let j = i + 1; j < areas.length; j++)
//       lines.push(`${areas[i]} ↔ ${areas[j]}: ~${Math.round((matrix?.[i]?.[j]||0)/60)} min`);
//   return lines.join('\n');
// }
// export function buildLLMPrompt(places, numDays, _, accommodationArea) {
//   const list = places.map(p =>
//     `  {"id":"${p._id}","name":"${p.name}","area":"${p.area}"}`
//   ).join(',\n');
//   const note = accommodationArea ? `\nStays in ${accommodationArea}.` : '';
//   return `Delhi planner. ${numDays}-day itinerary.${note}\n[\n${list}\n]\nJSON only: {"days":[["id1"]],"rationales":["..."]}`;
// }
// export function intensityBalanceCheck(places) {
//   const high = places.filter(p => (p.scores?.cultural_score ?? 0) >= 0.85);
//   const overflow = high.length > 2 ? high.slice(2) : [];
//   return { ok: !overflow.length, overflow };
// }
// export function validateAndRepair(rawDays, allPlaces, startDate, numDays) {
//   const ALWAYS = new Set(['all_days','event_based','seasonal','weekdays']);
//   const repaired = new Set();
//   const days = rawDays.map((ids, di) => {
//     let abbr = null;
//     if (startDate) {
//       const d = new Date(`${startDate}T12:00:00`);
//       d.setDate(d.getDate() + di);
//       abbr = DAY_ABBR[d.getDay()];
//     }
//     const places = ids.map(id => allPlaces.find(p => String(p._id) === String(id))).filter(Boolean);
//     const open   = places.filter(p => {
//       const od = (p.visit_info?.open_days ?? p.open_days ?? []);
//       if (!od.length || od.some(d => ALWAYS.has(d))) return true;
//       return !abbr || od.map(x => x.toLowerCase()).includes(abbr);
//     });
//     if (open.length !== places.length) repaired.add(di);
//     let used = 0; const trimmed = [];
//     for (const p of open) {
//       const dur = (p.visit_info?.avg_duration_min ?? p.avg_visit_duration_min ?? 60) + 30;
//       if (used + dur > 420) { repaired.add(di); break; }
//       trimmed.push(p); used += dur;
//     }
//     return trimmed;
//   });
//   return { days, repairedDayIndices: repaired };
// }
// export function computeCentroid(places) {
//   if (!places.length) return [77.2090, 28.6139];
//   return [
//     places.reduce((s,p) => s+(p.location?.coordinates?.[0]??p.longitude??77.21),0)/places.length,
//     places.reduce((s,p) => s+(p.location?.coordinates?.[1]??p.latitude??28.61),0)/places.length,
//   ];
// }
// export function generateFallbackRationale(places) {
//   if (!places.length) return 'A curated Delhi exploration day.';
//   const ac = {};
//   places.forEach(p => { ac[p.area||'Delhi'] = (ac[p.area||'Delhi']||0)+1; });
//   const area   = Object.entries(ac).sort((a,b)=>b[1]-a[1])[0][0];
//   const anchor = places.reduce((b,p) =>
//     (p.scores?.cultural_score??0)>(b.scores?.cultural_score??0)?p:b, places[0]);
//   return `${area} exploration anchored by ${anchor.name}.`;
// }
// export function injectFoodShopping(stops, includeFood, includeShopping) {
//   const out = []; let lunchDone = false, shopDone = false;
//   for (const s of stops) {
//     out.push(s);
//     const [h,m] = (s.arrival_time||'09:00').split(':').map(Number);
//     const end   = h*60+m+(s.visit_duration_min||60);
//     if (includeFood    && !lunchDone && end>=720 && s.amenities?.food_nearby)
//       { out.push({_cardType:'lunch',    name:'Lunch break nearby',visit_duration_min:45}); lunchDone=true; }
//     if (includeShopping && !shopDone  && end>=900 && s.amenities?.shopping_nearby)
//       { out.push({_cardType:'shopping', name:'Shopping stop',     visit_duration_min:45}); shopDone=true;  }
//   }
//   return out;
// }
// export function buildCacheKey({ interests, startDate, numDays, accommodationArea, excludedIds }) {
//   return JSON.stringify({
//     interests:         [...(interests||[])].sort(),
//     startDate:         startDate||'',
//     numDays:           numDays||1,
//     accommodationArea: accommodationArea||'',
//     excludedIds:       [...(excludedIds||[])].sort(),
//   });
// }

import Place       from '../models/PlaceSchema.js';
import Cluster     from '../models/Cluster.js';
import AnchorEvent from '../models/AnchorEvent.js';
import { getDistanceMatrix } from './osrm.service.js';
import { haversine }         from '../utils/geo.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const DAILY_BUDGET_MINS  = 480;
const DAY_START_HOUR     = 9;
const TRAVEL_BUFFER_MINS = 15;
const MAX_PLACES_PER_DAY = 6;
const DAY_ABBR = ['sun','mon','tue','wed','thu','fri','sat'];

const INTEREST_CATEGORY_MAP = {
  HERITAGE:      ['HERITAGE','CULTURAL','MUSEUM','EXHIBITION'],
  RELIGIOUS:     ['RELIGIOUS'],
  SHOPPING:      ['SHOPPING'],
  FOOD:          ['FOOD'],
  NATURE:        ['PARK','NATURE','WILDLIFE'],
  ENTERTAINMENT: ['ENTERTAINMENT','NIGHTLIFE','ACTIVITY'],
  MODERN:        ['MODERN','EDUCATIONAL'],
  SPORTS:        ['SPORTS'],
  WELLNESS:      ['WELLNESS'],
};

function interestMatchScore(clusterPlaces, userCategories) {
  if (!userCategories.length || !clusterPlaces.length) return 0.5;

  const expandedCats = new Set(
    userCategories.flatMap(c => INTEREST_CATEGORY_MAP[c.toUpperCase()] ?? [c.toUpperCase()])
  );
  const tagTerms = userCategories.map(c => c.toLowerCase());

  let weightedSum = 0;
  let totalWeight = 0;

  for (const p of clusterPlaces) {
    const quality = 0.6 * (p.scores?.cultural ?? 0) + 0.4 * (p.scores?.popularity ?? 0);
    totalWeight += quality;
    const catMatch = expandedCats.has(p.category?.toUpperCase());
    const tagMatch = (p.tags ?? []).some(t => tagTerms.includes(t.toLowerCase()));
    if (catMatch || tagMatch) weightedSum += quality;
  }

  return totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(4)) : 0.5;
}

function finalRank(cluster, interestMatch) {
  return parseFloat(
    ((cluster.base_rank_score ?? 0.5) * 0.60 + interestMatch * 0.40).toFixed(4)
  );
}

async function scheduleAnchorEvents(numDays, dayAbbrs) {
  const events = await AnchorEvent.find({})
    .sort({ priority_weight: -1 })
    .lean();

  const dayEventMap  = new Map();
  const usedEventIds = new Set();

  for (let d = 0; d < numDays; d++) {
    const today = dayAbbrs[d].toLowerCase();
    for (const ev of events) {
      if (usedEventIds.has(ev._id)) continue;
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

function distributeClustersToDays(rankedClusters, numDays, dayEventMap) {
  const anchorClusters = new Map();
  for (const [dayIdx, ev] of dayEventMap.entries()) {
    const ec = rankedClusters.find(c => (c.place_ids ?? []).includes(ev.place_id));
    if (ec) anchorClusters.set(dayIdx, ec._id);
  }

  const pool = rankedClusters.filter(
    c => ![...anchorClusters.values()].includes(c._id)
  );

  const dayHeadliners = Array.from({ length: numDays }, (_, d) => {
    const ac = anchorClusters.get(d);
    return ac ? [rankedClusters.find(c => c._id === ac)] : [];
  });

  pool.forEach((cluster, idx) => {
    dayHeadliners[idx % numDays].push(cluster);
  });

  return dayHeadliners;
}

// FIX: added anchorEventPlaceId parameter — skips that place so it only
// appears as the evening event card, not also as a morning regular visit
function expandCluster(cluster, placeMap, dayAbbr, budgetLeft, avoidCrowds, anchorEventPlaceId) {
  const candidates = (cluster.place_ids ?? [])
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

  candidates.sort((a, b) => {
    const aMain = String(a._id) === cluster.main_anchor_place_id ? 1 : 0;
    const bMain = String(b._id) === cluster.main_anchor_place_id ? 1 : 0;
    if (aMain !== bMain) return bMain - aMain;
    return avoidCrowds
      ? (a.scores?.popularity ?? 0) - (b.scores?.popularity ?? 0)
      : (b.scores?.cultural  ?? 0) - (a.scores?.cultural  ?? 0);
  });

  const selected = [];
  let   usedMins = 0;

  for (const p of candidates) {
    if (selected.length >= MAX_PLACES_PER_DAY) break;
    const dur = (p.avg_visit_duration_min || 60) + TRAVEL_BUFFER_MINS;
    if (usedMins + dur > budgetLeft) break;
    selected.push(p);
    usedMins += dur;
  }

  return { places: selected, usedMins };
}

async function optimiseRoute(places, hotelLat, hotelLng) {
  if (places.length <= 1) return { ordered: places, travelMins: [0] };

  let matrix;
  const coords = places.map(p => [p.longitude, p.latitude]);

  try {
    const raw = await getDistanceMatrix(coords, 'driving');
    matrix = raw;
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
    let   nearest = -1, minDur = Infinity;
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
          (matrix[route[i - 1]][route[i]] ?? 0) +
          (matrix[route[j]][route[j + 1] !== undefined ? route[j + 1] : route[0]] ?? 0);
        const after =
          (matrix[route[i - 1]][route[j]] ?? 0) +
          (matrix[route[i]][route[j + 1] !== undefined ? route[j + 1] : route[0]] ?? 0);
        if (after < before - 1) {
          route.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }

  const ordered    = route.map(i => places[i]);
  const travelMins = route.map((r, idx) => {
    if (idx === 0) return 0;
    return Math.round((matrix[route[idx - 1]][r] ?? 0) / 60);
  });

  return { ordered, travelMins };
}

// FIX: if anchor event place already visited today, attach note to
// existing card instead of creating a duplicate card
function buildTimedDay(orderedPlaces, travelMins, anchorEvent) {
  const timeline = [];
  let   cursor   = DAY_START_HOUR * 60;

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
  });

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
    let showMins = cursor + 30;
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
// MAIN EXPORT
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
    dayAbbrs   = Array.from({ length: numDays }, (_, i) => DAY_ABBR[(base < 0 ? 1 : base + i) % 7]);
  }

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
      const cPlaces  = (c.place_ids ?? []).map(id => placeMap[String(id)]).filter(Boolean);
      const imatch   = interestMatchScore(cPlaces, categories);
      const rank     = finalRank(c, imatch);
      return { ...c, _placeCount: cPlaces.length, _interestMatch: imatch, _finalRank: rank };
    })
    .filter(c => c._placeCount > 0)
    .sort((a, b) => b._finalRank - a._finalRank);

  const dayEventMap     = await scheduleAnchorEvents(numDays, dayAbbrs);
  const dayClusterLists = distributeClustersToDays(rankedClusters, numDays, dayEventMap);

  const usedClusterIds = new Set();
  const itinerary      = [];

  for (let d = 0; d < numDays; d++) {
    const dayAbbr     = dayAbbrs[d];
    const anchorEvent = dayEventMap.get(d) ?? null;
    let   budgetLeft  = DAILY_BUDGET_MINS;
    const rawPlaces   = [];

    if (anchorEvent) {
      budgetLeft -= (anchorEvent.duration_min ?? 60) + TRAVEL_BUFFER_MINS;
    }

    for (const cluster of (dayClusterLists[d] ?? [])) {
      if (budgetLeft < 60)                 break;
      if (usedClusterIds.has(cluster._id)) continue;

      const { places, usedMins } = expandCluster(
        cluster, placeMap, dayAbbr, budgetLeft, avoidCrowds,
        anchorEvent?.place_id   // FIX: skip anchor place from daytime slots
      );
      if (!places.length) continue;

      rawPlaces.push(...places);
      budgetLeft -= usedMins;
      usedClusterIds.add(cluster._id);
    }

    if (rawPlaces.length === 0) {
      for (const cluster of rankedClusters) {
        if (budgetLeft < 60)                 break;
        if (usedClusterIds.has(cluster._id)) continue;

        const { places, usedMins } = expandCluster(
          cluster, placeMap, dayAbbr, budgetLeft, avoidCrowds,
          anchorEvent?.place_id   // FIX: skip anchor place from daytime slots
        );
        if (!places.length) continue;
        rawPlaces.push(...places);
        budgetLeft -= usedMins;
        usedClusterIds.add(cluster._id);
      }
    }

    const { ordered, travelMins } = await optimiseRoute(rawPlaces, lat, lng);
    const timeline      = buildTimedDay(ordered, travelMins, anchorEvent);
    const totalVisitMin = ordered.reduce((s, p) => s + (p.avg_visit_duration_min || 60), 0);

    itinerary.push({
      day:             d + 1,
      day_of_week:     dayAbbr,
      total_places:    ordered.length + (anchorEvent ? 1 : 0),
      total_visit_min: totalVisitMin,
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
    mode:       'city_wide_v2',
    num_days:   numDays,
    categories,
    trip_time:  tripTime,
    itinerary,
  };
}

function minsToTime(m) {
  const h   = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

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
export function buildAreaTravelContext(areas, matrix) {
  if (!areas || areas.length < 2) return '';
  const lines = [];
  for (let i = 0; i < areas.length - 1; i++)
    for (let j = i + 1; j < areas.length; j++)
      lines.push(`${areas[i]} ↔ ${areas[j]}: ~${Math.round((matrix?.[i]?.[j]||0)/60)} min`);
  return lines.join('\n');
}
export function buildLLMPrompt(places, numDays, _, accommodationArea) {
  const list = places.map(p =>
    `  {"id":"${p._id}","name":"${p.name}","area":"${p.area}"}`
  ).join(',\n');
  const note = accommodationArea ? `\nStays in ${accommodationArea}.` : '';
  return `Delhi planner. ${numDays}-day itinerary.${note}\n[\n${list}\n]\nJSON only: {"days":[["id1"]],"rationales":["..."]}`;
}
export function intensityBalanceCheck(places) {
  const high     = places.filter(p => (p.scores?.cultural_score ?? 0) >= 0.85);
  const overflow = high.length > 2 ? high.slice(2) : [];
  return { ok: !overflow.length, overflow };
}
export function validateAndRepair(rawDays, allPlaces, startDate, numDays) {
  const ALWAYS   = new Set(['all_days','event_based','seasonal','weekdays']);
  const repaired = new Set();
  const days     = rawDays.map((ids, di) => {
    let abbr = null;
    if (startDate) {
      const d = new Date(`${startDate}T12:00:00`);
      d.setDate(d.getDate() + di);
      abbr = DAY_ABBR[d.getDay()];
    }
    const places = ids.map(id => allPlaces.find(p => String(p._id) === String(id))).filter(Boolean);
    const open   = places.filter(p => {
      const od = (p.visit_info?.open_days ?? p.open_days ?? []);
      if (!od.length || od.some(d => ALWAYS.has(d))) return true;
      return !abbr || od.map(x => x.toLowerCase()).includes(abbr);
    });
    if (open.length !== places.length) repaired.add(di);
    let used = 0;
    const trimmed = [];
    for (const p of open) {
      const dur = (p.visit_info?.avg_duration_min ?? p.avg_visit_duration_min ?? 60) + 30;
      if (used + dur > 420) { repaired.add(di); break; }
      trimmed.push(p);
      used += dur;
    }
    return trimmed;
  });
  return { days, repairedDayIndices: repaired };
}
export function computeCentroid(places) {
  if (!places.length) return [77.2090, 28.6139];
  return [
    places.reduce((s,p) => s+(p.location?.coordinates?.[0]??p.longitude??77.21),0)/places.length,
    places.reduce((s,p) => s+(p.location?.coordinates?.[1]??p.latitude??28.61),0)/places.length,
  ];
}
export function generateFallbackRationale(places) {
  if (!places.length) return 'A curated Delhi exploration day.';
  const ac = {};
  places.forEach(p => { ac[p.area||'Delhi'] = (ac[p.area||'Delhi']||0)+1; });
  const area   = Object.entries(ac).sort((a,b)=>b[1]-a[1])[0][0];
  const anchor = places.reduce((b,p) =>
    (p.scores?.cultural_score??0)>(b.scores?.cultural_score??0)?p:b, places[0]);
  return `${area} exploration anchored by ${anchor.name}.`;
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
export function buildCacheKey({ interests, startDate, numDays, accommodationArea, excludedIds }) {
  return JSON.stringify({
    interests:         [...(interests||[])].sort(),
    startDate:         startDate||'',
    numDays:           numDays||1,
    accommodationArea: accommodationArea||'',
    excludedIds:       [...(excludedIds||[])].sort(),
  });
}
