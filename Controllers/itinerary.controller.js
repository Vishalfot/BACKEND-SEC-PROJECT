// import Place from '../models/PlaceSchema.js';
// import { getDistanceMatrix, getRoutePath } from '../services/osrm.service.js';
// import { calculateCompositeScore } from '../utils/scoring.js';
// import { composeDaysWithGemini } from '../services/llm.service.js';
// import { optimizeCustomRoute } from '../services/mode3.service.js';
// import { buildCityWideItinerary } from '../services/mode2.service.js';
// import {
//     getNearbyPlacesGeo
// } from '../services/mode1.service.js';
// import { readFileSync } from 'fs';
// import { fileURLToPath } from 'url';
// import { dirname, join } from 'path';

// // Load GeoJSON once at startup
// const __filename = fileURLToPath(import.meta.url);
// const __dirname  = dirname(__filename);
// let _delhiboundaries = null;
// function getDelhiboundaries() {
//     if (!_delhiboundaries) {
//         try {
//             const raw = readFileSync(join(__dirname, '../data/delhi_area_boundaries.geojson'), 'utf8');
//             _delhiboundaries = JSON.parse(raw);
//         } catch (e) {
//             console.warn('[Mode1] Could not load GeoJSON boundaries:', e.message);
//             _delhiboundaries = { features: [] };
//         }
//     }
//     return _delhiboundaries;
// }

// export const getPlacesList = async (req, res) => {
//     try {
//         const places = await Place.find({}, '_id name category').sort({ name: 1 }).lean();
//         return res.status(200).json({ success: true, data: places });
//     } catch (error) {
//         console.error('Fetch Places Error:', error);
//         res.status(500).json({ success: false, error: 'Failed to fetch places' });
//     }
// };

// // ──────────────────────────────────────────
// // MODE 1 — Nearby (Zone-first + Greedy + 2-opt)
// // ──────────────────────────────────────────
// export const getNearbyPlaces = async (req, res) => {
//     try {
//         const {
//             longitude,
//             latitude,
//             categories  = [],
//             budget      = 9999,
//             avoidCrowds = false
//         } = req.query; // often passed via query params for GET
        
//         // Also support body if it's a POST
//         const lng = parseFloat(longitude || req.body.longitude);
//         const lat = parseFloat(latitude  || req.body.latitude);
//         const parseCategories = categories.length ? categories : (req.body.categories || []);
//         const parseBudget = budget !== 9999 ? parseInt(budget) : (parseInt(req.body.budget) || 9999);
//         const parseAvoid = avoidCrowds || req.body.avoidCrowds || false;

//         if (isNaN(lng) || isNaN(lat)) {
//             return res.status(400).json({ success: false, message: 'longitude and latitude required' });
//         }

//         const result = await getNearbyPlacesGeo({
//             lat,
//             lng,
//             categories: typeof parseCategories === 'string' ? parseCategories.split(',').map(c => c.trim()) : parseCategories,
//             budgetMax: parseBudget,
//             avoidCrowds: parseAvoid
//         });

//         return res.status(200).json({
//             success: true,
//             ...result
//         });
//     } catch (error) {
//         console.error('Mode 1 Error:', error);
//         res.status(500).json({ success: false, error: error.message || 'Failed to fetch nearby places' });
//     }
// };


// // ──────────────────────────────────────────
// // MODE 2 — City-Wide LLM (Corrected Pipeline)
// // ──────────────────────────────────────────



// /**
//  * Maps pace string to max places per day
//  */
// const PACE_TO_MAX = { relaxed: 4, moderate: 5, packed: 6 };

// // Excel stores open_days as 3-letter lowercase abbreviations
// const DAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// // These special values mean the place is open on all/any days
// const ALWAYS_OPEN_VALUES = new Set(['all_days', 'event_based', 'seasonal', 'weekdays']);

// /**
//  * Get an array of 3-letter day abbreviations for the range [startDate, startDate+numDays)
//  */
// function getTravelDayAbbrs(startDate, numDays) {
//     const abbrs = new Set();
//     for (let i = 0; i < numDays; i++) {
//         // Use T12:00:00 (local noon) to avoid UTC midnight rolling back to the previous day in IST/timezones ahead of UTC
//         const d = new Date(startDate + 'T12:00:00');
//         d.setDate(d.getDate() + i);
//         abbrs.add(DAY_ABBR[d.getDay()]);
//     }
//     return [...abbrs];
// }

// export const generateCityWideItinerary = async (req, res) => {
//     try {
//         const {
//             lat,
//             lng,
//             categories      = [],
//             num_days        = 3,
//             budget_max      = 9999,
//             trip_time       = 'morning',
//             avoid_crowds    = false,
//             day_of_week     = 'mon'
//         } = req.body;

//         if (!lat || !lng) {
//             return res.status(400).json({ success: false, message: 'lat and lng are required' });
//         }

//         const result = await buildCityWideItinerary({
//             lat: parseFloat(lat),
//             lng: parseFloat(lng),
//             categories,
//             numDays: parseInt(num_days),
//             budgetMax: parseInt(budget_max),
//             tripTime: trip_time,
//             avoidCrowds: avoid_crowds,
//             dayOfWeek: day_of_week
//         });

//         return res.status(200).json({ 
//             success: true, 
//             data: result.itinerary,
//             meta: {
//                 num_days: result.num_days,
//                 trip_time: result.trip_time,
//                 categories: result.categories
//             }
//         });

//     } catch (error) {
//         console.error('Mode 2 Error:', error);
//         res.status(500).json({ success: false, error: error.message || 'Failed to generate city-wide itinerary' });
//     }
// };

// // ──────────────────────────────────────────
// // MODE 3 — Route Optimization (Corrected Pipeline)
// // ──────────────────────────────────────────
// export const buildCustomRoute = async (req, res) => {
//     try {
//         const {
//             selectedPlaces,   // array of place object or ids
//             place_ids,        // alternative
//             longitude,
//             latitude,
//             start_lat,        // alternative
//             start_lng,        // alternative
//             startTime = '09:00',
//             start_time        // alternative
//         } = req.body;

//         const ids = place_ids || (selectedPlaces ? selectedPlaces.map(p => p._id || p) : []);
//         const sLat = parseFloat(start_lat || latitude);
//         const sLng = parseFloat(start_lng || longitude);
//         const sTime = start_time || startTime;

//         if (!ids || ids.length === 0) {
//             return res.status(400).json({ success: false, message: 'place_ids must be provided' });
//         }
//         if (isNaN(sLat) || isNaN(sLng)) {
//             return res.status(400).json({ success: false, message: 'start_lat and start_lng must be provided' });
//         }

//         const result = await optimizeCustomRoute({
//             placeIds: ids,
//             startLat: sLat,
//             startLng: sLng,
//             startTime: sTime
//         });

//         if (result.error) {
//             return res.status(400).json({ success: false, ...result });
//         }

//         return res.status(200).json({ success: true, ...result });

//     } catch (error) {
//         console.error('Mode 3 Error:', error);
//         res.status(500).json({ success: false, error: error.message || 'Failed to generate custom route' });
//     }
// };

/**
 * Controllers/itinerary.controller.js
 * Mode 1 and Mode 3 are UNCHANGED.
 * Mode 2 wired to new buildCityWideItinerary + accepts start_date param.
 */
import Place                   from '../models/PlaceSchema.js';
import { getDistanceMatrix }   from '../services/osrm.service.js';
import { optimizeCustomRoute } from '../services/mode3.service.js';
import { buildCityWideItinerary } from '../services/mode2.service.js';
import { getNearbyPlacesGeo }  from '../services/mode1.service.js';
import { readFileSync }        from 'fs';
import { fileURLToPath }       from 'url';
import { dirname, join }       from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

let _boundaries = null;
function getDelhiboundaries() {
  if (!_boundaries) {
    try {
      _boundaries = JSON.parse(readFileSync(join(__dirname, '../data/delhi_area_boundaries.geojson'), 'utf8'));
    } catch { _boundaries = { features: [] }; }
  }
  return _boundaries;
}

// ─── Places list ──────────────────────────────────────────────────────────────
export const getPlacesList = async (req, res) => {
  try {
    const places = await Place.find({}, '_id name category').sort({ name: 1 }).lean();
    return res.status(200).json({ success: true, data: places });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch places' });
  }
};

// ─── MODE 1 — Nearby (unchanged) ─────────────────────────────────────────────
export const getNearbyPlaces = async (req, res) => {
  try {
    const { longitude, latitude, categories = [], budget = 9999, avoidCrowds = false } = req.query;
    const lng = parseFloat(longitude || req.body.longitude);
    const lat = parseFloat(latitude  || req.body.latitude);
    const cats = (categories.length ? categories : (req.body.categories || []));
    if (isNaN(lng) || isNaN(lat))
      return res.status(400).json({ success: false, message: 'longitude and latitude required' });

    const result = await getNearbyPlacesGeo({
      lat, lng,
      categories:  typeof cats === 'string' ? cats.split(',').map(c=>c.trim()) : cats,
      budgetMax:   parseInt(budget)||9999,
      avoidCrowds: avoidCrowds || req.body.avoidCrowds || false,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ─── MODE 2 — City-Wide (updated) ────────────────────────────────────────────
export const generateCityWideItinerary = async (req, res) => {
  try {
    const {
      lat, lng,
      categories   = [],
      num_days     = 3,
      budget_max   = 9999,
      trip_time    = 'morning',
      avoid_crowds = false,
      day_of_week  = 'mon',
      start_date   = null,   // "2026-04-14" — enables exact open_days checking
    } = req.body;

    if (!lat || !lng)
      return res.status(400).json({ success: false, message: 'lat and lng are required' });

    const result = await buildCityWideItinerary({
      lat:         parseFloat(lat),
      lng:         parseFloat(lng),
      categories,
      numDays:     parseInt(num_days),
      budgetMax:   parseInt(budget_max),
      tripTime:    trip_time,
      avoidCrowds: avoid_crowds,
      dayOfWeek:   day_of_week,
      startDate:   start_date,
    });

    return res.status(200).json({
      success: true,
      data:    result.itinerary,
      meta: {
        num_days:   result.num_days,
        trip_time:  result.trip_time,
        categories: result.categories,
        mode:       result.mode,
      },
    });
  } catch (e) {
    console.error('Mode 2 Error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
};

// ─── MODE 3 — Custom Route (unchanged) ───────────────────────────────────────
export const buildCustomRoute = async (req, res) => {
  try {
    const {
      selectedPlaces, place_ids,
      longitude, latitude, start_lat, start_lng,
      startTime = '09:00', start_time,
    } = req.body;

    const ids  = place_ids || (selectedPlaces ? selectedPlaces.map(p => p._id || p) : []);
    const sLat = parseFloat(start_lat || latitude);
    const sLng = parseFloat(start_lng || longitude);

    if (!ids?.length)
      return res.status(400).json({ success: false, message: 'place_ids must be provided' });
    if (isNaN(sLat) || isNaN(sLng))
      return res.status(400).json({ success: false, message: 'start_lat and start_lng must be provided' });

    const result = await optimizeCustomRoute({
      placeIds: ids, startLat: sLat, startLng: sLng, startTime: start_time || startTime,
    });

    if (result.error) return res.status(400).json({ success: false, ...result });
    return res.status(200).json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
