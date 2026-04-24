import Place                   from '../models/PlaceSchema.js';
import { getDistanceMatrix }   from '../services/osrm.service.js';
import { optimizeCustomRoute } from '../services/mode3.service.js';
import { buildCityWideItinerary, getClusterPlacesSorted } from '../services/mode2.service.js';
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

// ─── MODE 2 — City-Wide ───────────────────────────────────────────────────────
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
      start_date   = null,
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

// ─── MODE 2 — Cluster Expand (NEW) ───────────────────────────────────────────
// GET /api/itinerary/cluster/:clusterId/places?categories=HERITAGE,FOOD
// Returns all places in a cluster sorted by interest match score.
// Frontend uses this when user taps "Show all places in this cluster".
export const getClusterPlaces = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const categoriesRaw = req.query.categories || req.body.categories || '';
    const categories = typeof categoriesRaw === 'string'
      ? categoriesRaw.split(',').map(c => c.trim()).filter(Boolean)
      : categoriesRaw;

    if (!clusterId)
      return res.status(400).json({ success: false, message: 'clusterId is required' });

    const result = await getClusterPlacesSorted(clusterId, categories);
    return res.status(200).json({ success: true, data: result });
  } catch (e) {
    console.error('Cluster expand error:', e);
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