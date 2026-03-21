// Server/services/mode1.service.js
// ─────────────────────────────────────────────────────────────────────────────
// Mode 1: "Nearby Places" — Spontaneous Explorer
// "I have a few hours to kill right now, what's good around here?"
// ─────────────────────────────────────────────────────────────────────────────

import Place from '../models/PlaceSchema.js';
import { getDayKey, getTimeSlot, rankValueExpression } from '../utils/geo.js';

const RESULT_TARGET   = 8;    // minimum acceptable results before expanding
const RADIUS_STEPS    = [800, 1500, 2500, 4000]; // metres — expands if too few results
const MAX_RESULTS     = 12;

/**
 * @param {Object} params
 * @param {number} params.lat           - User latitude
 * @param {number} params.lng           - User longitude
 * @param {string[]} params.categories  - Selected categories e.g. ['HERITAGE','RELIGIOUS']
 * @param {number} params.budgetMax     - Max entry fee in INR (0 = free only)
 * @param {boolean} params.avoidCrowds  - Prefer less-crowded places
 * @param {Date}   [params.now]         - Defaults to current time (injectable for testing)
 */
export async function getNearbyPlacesGeo({ lat, lng, categories = [], budgetMax = 9999, avoidCrowds = false, now = new Date() }) {

  const today    = getDayKey(now);
  const timeSlot = getTimeSlot(now.getHours());

  // Build category filter — if empty, show all categories
  const categoryFilter = categories.length
    ? { $or: [{ category: { $in: categories } }, { tags: { $in: categories.map(c => c.toLowerCase()) } }] }
    : {};

  let results = [];
  let usedRadiusM = RADIUS_STEPS[0];

  // ── Step 1+2: geo query with expanding radius ─────────────────────────────
  for (const radiusM of RADIUS_STEPS) {
    usedRadiusM = radiusM;

    let query = {
      'entry_fee.indian': { $lte: budgetMax },
      is_sub_place:    { $ne: true },
      ...categoryFilter,
    };

    results = await Place.aggregate([
      {
        $geoNear: {
          near:          { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'dist_m',
          maxDistance:   radiusM,
          spherical:     true,
          query:         query,
        },
      },

      // ── Step 3: compute rank_value ────────────────────────────────────────
      {
        $addFields: {
          ...rankValueExpression({ categories, radiusM, userLng: lng, userLat: lat, timeSlot, avoidCrowds }),
        },
      },

      { $sort:  { rank_value: -1 } },
      { $limit: MAX_RESULTS },

      // ── Step 4: shape the response ────────────────────────────────────────
      {
        $project: {
          _id: 1, name: 1, category: 1, area: 1,
          latitude: 1, longitude: 1,
          scores: 1, avg_visit_duration_min: 1,
          best_time_of_day: 1, entry_fee: 1, amenities: 1,
          short_description: 1, image_filename: 1,
          is_anchor_place: 1, anchor_event_details: 1,
          official_website: 1,
          metro: 1,
          tags: 1,
          open_days: 1,
          dist_m: 1,
          rank_value: { $round: ['$rank_value', 3] },
          time_slot_match: { $in: [timeSlot, { $ifNull: ['$best_time_of_day', []] }] },
        },
      },
    ]);

    if (results.length >= RESULT_TARGET) break; // enough results — stop expanding
  }

  // ── Format output ─────────────────────────────────────────────────────────
  return {
    mode:         'nearby',
    user_location: { lat, lng },
    search_radius_m: usedRadiusM,
    time_slot:    timeSlot,
    day:          today,
    total_found:  results.length,
    places:       results.map(formatPlace),
  };
}

function formatPlace(p) {
  return {
    id:                    p._id,
    name:                  p.name,
    category:              p.category,
    area:                  p.area,
    distance_m:            Math.round(p.dist_m),
    walk_time_min:         Math.round(p.dist_m / 80),  // avg walking speed 80m/min
    visit_duration_min:    p.avg_visit_duration_min,
    rank_value:            p.rank_value,
    best_now:              p.time_slot_match,
    open_days:             p.open_days || [],
    entry_fee_indian:      p.entry_fee?.indian ?? 0,
    is_anchor:             p.is_anchor_place,
    anchor_event:          p.anchor_event_details || null,
    metro:                 p.metro,
    short_description:     p.short_description,
    image:                 p.image_filename,
    official_website:      p.official_website || null,
    amenities:             p.amenities,
    coords:                { lat: p.latitude, lng: p.longitude },
  };
}
