// Server/utils/geo.js
// Shared helpers for all 3 modes

/**
 * Haversine distance in metres between two lat/lng points.
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180)
             * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Get [lat, lng] from either a Place doc or a cluster unit.
 * Cluster units expose a centroid; single places use their own coords.
 */
export function getCoords(unit) {
  if (unit.centroid) return [unit.centroid.lat, unit.centroid.lng];
  const p = unit.places?.[0] ?? unit;
  return [p.latitude, p.longitude];
}

/**
 * Compute the geographic centroid of a list of places.
 */
export function centroid(places) {
  const lat = places.reduce((s, p) => s + p.latitude,  0) / places.length;
  const lng = places.reduce((s, p) => s + p.longitude, 0) / places.length;
  return { lat, lng };
}

/**
 * Nearest-neighbour ordering of a list of units (places or cluster blocks).
 * Returns units in travel order starting from [startLat, startLng].
 */
export function nearestNeighbourOrder(units, startLat, startLng) {
  const unvisited = [...units];
  const route     = [];
  let   curLat    = startLat;
  let   curLng    = startLng;

  while (unvisited.length) {
    let nearest  = null;
    let nearDist = Infinity;

    for (const u of unvisited) {
      const [lat, lng] = getCoords(u);
      const d = haversine(curLat, curLng, lat, lng);
      if (d < nearDist) { nearest = u; nearDist = d; }
    }

    route.push(nearest);
    const [lat, lng] = getCoords(nearest);
    curLat = lat;
    curLng = lng;
    unvisited.splice(unvisited.indexOf(nearest), 1);
  }

  return route;
}

/**
 * Brute-force all permutations for n ≤ 10 (Mode 3).
 * Returns the permutation with shortest total distance.
 */
export function bruteForceTSP(places, startLat, startLng) {
  if (places.length === 0) return [];
  if (places.length === 1) return places;

  function permutations(arr) {
    if (arr.length <= 1) return [arr];
    return arr.flatMap((v, i) =>
      permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [v, ...p])
    );
  }

  function routeDistance(perm, sLat, sLng) {
    let dist = 0;
    let lat  = sLat, lng = sLng;
    for (const p of perm) {
      dist += haversine(lat, lng, p.latitude, p.longitude);
      lat   = p.latitude;
      lng   = p.longitude;
    }
    return dist;
  }

  let best = null, bestDist = Infinity;
  for (const perm of permutations(places)) {
    const d = routeDistance(perm, startLat, startLng);
    if (d < bestDist) { best = perm; bestDist = d; }
  }
  return best;
}

/**
 * Convert current hour → time slot string.
 */
export function getTimeSlot(hour) {
  if (hour >= 6  && hour < 13) return 'morning';
  if (hour >= 13 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Convert Date → three-letter day name used in open_days field.
 */
export function getDayKey(date = new Date()) {
  return ['sun','mon','tue','wed','thu','fri','sat'][date.getDay()];
}

/**
 * Build the rank_value $addFields expression for MongoDB aggregation.
 * Weights:  interest 0.35 | cultural 0.25 | proximity 0.20 | time 0.10 | crowd 0.10
 */
export function rankValueExpression({ categories, radiusM, userLng, userLat, timeSlot, avoidCrowds = false }) {
  const interestW  = avoidCrowds ? 0.35 : 0.45;
  const crowdW     = avoidCrowds ? 0.10 : 0.00;

  return {
    interest_w: {
      $cond: [{ $in: ['$category', categories] }, 1.0, 0.6],
    },
    cultural_w: '$scores.cultural',
    proximity_w: {
      $max: [0, {
        $subtract: [1, {
          $divide: ['$dist_m', radiusM],
        }],
      }],
    },
    time_w: {
      $cond: [{ $in: [timeSlot, { $ifNull: ['$best_time_of_day', []] }] }, 1.0, 0.4],
    },
    crowd_w: { $subtract: [1, { $ifNull: ['$scores.popularity', 0.5] }] },
    rank_value: {
      $add: [
        { $multiply: ['$interest_w',  interestW] },
        { $multiply: ['$cultural_w',  0.25] },
        { $multiply: ['$proximity_w', 0.20] },
        { $multiply: ['$time_w',      0.10] },
        { $multiply: ['$crowd_w',     crowdW] },
      ],
    },
  };
}
