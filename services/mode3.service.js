// Server/services/mode3.service.js
// ─────────────────────────────────────────────────────────────────────────────
// Mode 3: "Custom Route" — DIY Optimizer
// "I know exactly what places I want to see, just tell me the most efficient order."
//
// Algorithm:
//   1. MongoDB fetches the fixed list by _id — no scoring, no filtering
//   2. Anchor places locked to their best time slot (Red Fort → evening)
//   3. TSP: brute-force if n ≤ 10, nearest-neighbour if 11–15, error if > 15
//   4. Return ordered route with cumulative time map + travel estimates
// ─────────────────────────────────────────────────────────────────────────────

import Place from '../models/PlaceSchema.js';
import { haversine, nearestNeighbourOrder, bruteForceTSP } from '../utils/geo.js';

const TSP_BRUTE_FORCE_LIMIT  = 10;
const TSP_HEURISTIC_LIMIT    = 15;
const WALK_SPEED_MPS         = 1.2;  // metres per second — average tourist walk
const TRANSIT_OVERHEAD_MIN   = 15;   // buffer for metro/auto between distant stops

/**
 * @param {Object}   params
 * @param {string[]} params.placeIds    Array of place _id strings chosen by user
 * @param {number}   params.startLat    User's starting point latitude
 * @param {number}   params.startLng    User's starting point longitude
 * @param {string}   params.startTime   '09:00' — trip start time (HH:MM 24h)
 */
export async function optimizeCustomRoute({ placeIds, startLat, startLng, startTime = '09:00' }) {

  if (!placeIds?.length) {
    return { error: 'No places selected.' };
  }
  if (placeIds.length > TSP_HEURISTIC_LIMIT) {
    return {
      error: `${placeIds.length} stops is too many for a single day. Maximum is ${TSP_HEURISTIC_LIMIT}. Split across multiple days.`,
      suggestion: 'Use Mode 2 (City-Wide) with your preferred categories for multi-day planning.',
    };
  }

  // ── Step 1: MongoDB fetch — only the fields needed for routing ────────────
  const places = await Place.find(
    { _id: { $in: placeIds } },
    {
      _id: 1, name: 1, category: 1, area: 1, latitude: 1, longitude: 1,
      avg_visit_duration_min: 1, best_time_of_day: 1,
      is_anchor_place: 1, anchor_event_details: 1,
      entry_fee: 1, metro: 1, short_description: 1,
      image_filename: 1, official_website: 1, amenities: 1,
    }
  ).lean();

  // Warn if any requested IDs weren't found
  const foundIds   = places.map(p => String(p._id));
  const missingIds = placeIds.filter(id => !foundIds.includes(String(id)));

  // ── Step 2: separate anchors from free stops ──────────────────────────────
  const anchors   = places.filter(p => p.is_anchor_place);
  const freeStops = places.filter(p => !p.is_anchor_place);

  // Build time-slot buckets — anchors lock their slot
  const schedule = { morning: [], afternoon: [], evening: [] };

  for (const anchor of anchors) {
    const times = anchor.best_time_of_day ?? [];
    const slot  = times.includes('evening') ? 'evening'
                : times.includes('morning') ? 'morning'
                : 'afternoon';
    schedule[slot].push(anchor);
  }

  // Free stops fill morning by default — will be route-ordered around anchors
  schedule.morning.push(...freeStops);

  // ── Step 3: TSP per slot ──────────────────────────────────────────────────
  const n = places.length;
  let orderedMorning, orderedAfternoon, orderedEvening;

  if (n <= TSP_BRUTE_FORCE_LIMIT) {
    // Brute-force optimal — guarantees shortest path
    orderedMorning   = bruteForceTSP(schedule.morning,   startLat, startLng);
    orderedAfternoon = bruteForceTSP(schedule.afternoon, startLat, startLng);
    orderedEvening   = bruteForceTSP(schedule.evening,   startLat, startLng);
  } else {
    // Nearest-neighbour heuristic — fast, ~15% longer than optimal
    orderedMorning   = nearestNeighbourOrder(schedule.morning,   startLat, startLng);
    orderedAfternoon = nearestNeighbourOrder(schedule.afternoon, startLat, startLng);
    orderedEvening   = nearestNeighbourOrder(schedule.evening,   startLat, startLng);
  }

  const allOrdered = [...orderedMorning, ...orderedAfternoon, ...orderedEvening];

  // ── Step 4: build cumulative time map ─────────────────────────────────────
  const route         = buildTimedRoute(allOrdered, startLat, startLng, startTime);
  const totalDistM    = route.reduce((s, s2) => s + (s2.travel_from_prev_m ?? 0), 0);
  const totalVisitMin = places.reduce((s, p) => s + (p.avg_visit_duration_min || 60), 0);
  const totalTravelMin= route.reduce((s, s2) => s + (s2.travel_time_min ?? 0), 0);

  return {
    mode:           'custom_route',
    total_stops:    places.length,
    algorithm_used: n <= TSP_BRUTE_FORCE_LIMIT ? 'brute_force_optimal' : 'nearest_neighbour_heuristic',
    missing_ids:    missingIds,
    summary: {
      total_places:     places.length,
      total_visit_min:  totalVisitMin,
      total_travel_min: Math.round(totalTravelMin),
      total_day_min:    Math.round(totalVisitMin + totalTravelMin),
      total_distance_m: Math.round(totalDistM),
    },
    route,
    slots: {
      morning:   orderedMorning.map(p => p._id),
      afternoon: orderedAfternoon.map(p => p._id),
      evening:   orderedEvening.map(p => p._id),
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build route with arrival/departure times and travel estimates.
 */
function buildTimedRoute(places, startLat, startLng, startTime) {
  const [startH, startM] = startTime.split(':').map(Number);
  let currentMins = startH * 60 + startM;
  let prevLat     = startLat;
  let prevLng     = startLng;

  return places.map((p, i) => {
    const distM       = haversine(prevLat, prevLng, p.latitude, p.longitude);
    const isWalkable  = distM <= 1500; // within 1.5km → walk, else transit
    const travelMin   = isWalkable
      ? Math.round(distM / (WALK_SPEED_MPS * 60))
      : Math.round(distM / (WALK_SPEED_MPS * 60)) + TRANSIT_OVERHEAD_MIN;

    if (i > 0) currentMins += travelMin;

    const arrivalTime   = minsToTime(currentMins);
    const visitDuration = p.avg_visit_duration_min || 60;
    currentMins        += visitDuration;
    const departureTime = minsToTime(currentMins);

    prevLat = p.latitude;
    prevLng = p.longitude;

    return {
      stop:               i + 1,
      id:                 p._id,
      name:               p.name,
      category:           p.category,
      area:               p.area,
      coords:             { lat: p.latitude, lng: p.longitude },
      arrival_time:       arrivalTime,
      visit_duration_min: visitDuration,
      departure_time:     departureTime,
      is_anchor:          p.is_anchor_place,
      anchor_event:       p.anchor_event_details || null,
      entry_fee_indian:   p.entry_fee?.indian ?? 0,
      metro:              p.metro,
      short_description:  p.short_description,
      image:              p.image_filename,
      official_website:   p.official_website || null,
      amenities:          p.amenities,
      travel_from_prev_m: i === 0 ? 0 : Math.round(distM),
      travel_time_min:    i === 0 ? 0 : travelMin,
      travel_mode:        i === 0 ? null : (isWalkable ? 'walk' : 'auto_or_metro'),
    };
  });
}

function minsToTime(totalMins) {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
