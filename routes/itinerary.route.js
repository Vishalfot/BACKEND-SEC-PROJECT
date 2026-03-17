import express from 'express';
import { getNearbyPlaces, generateCityWideItinerary, calculateOptimalRoute, getPlacesList } from '../Controllers/itinerary.controller.js';
import verifyToken from '../middleware/authentication.js';

const router = express.Router();

/**
 * MODE 1: Nearby, location-based
 * POST /api/itinerary/nearby
 */
router.post('/nearby', verifyToken, getNearbyPlaces);

/**
 * Get all places for UI selection
 * GET /api/itinerary/places
 */
router.get('/places', verifyToken, getPlacesList);

/**
 * MODE 2: City-wide, interest + food, non-hectic (uses LLM)
 * POST /api/itinerary/city-wide
 */
router.post('/city-wide', verifyToken, generateCityWideItinerary);

/**
 * MODE 3: User picks places -> best route
 * POST /api/itinerary/route
 */
router.post('/route', verifyToken, calculateOptimalRoute);

export default router;