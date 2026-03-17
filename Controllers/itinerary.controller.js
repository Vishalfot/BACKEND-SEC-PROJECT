import Place from '../models/PlaceSchema.js';
import { getDistanceMatrix, getRoutePath, nearestNeighborWith2Opt } from '../services/osrm.service.js';
import { calculateCompositeScore } from '../utils/scoring.js';
import { sliceIntoDays } from '../utils/daySlicer.js';
import { composeDaysWithGemini } from '../services/llm.service.js';

export const getPlacesList = async (req, res) => {
    try {
        const places = await Place.find({}, '_id name category').sort({ name: 1 }).lean();
        return res.status(200).json({ success: true, data: places });
    } catch (error) {
        console.error('Fetch Places Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch places' });
    }
};

// ──────────────────────────────────────────
// MODE 1 — Nearby
// ──────────────────────────────────────────
export const getNearbyPlaces = async (req, res) => {
    try {
        const { longitude, latitude, radiusKm = 5, limit = 5, tags = [] } = req.body;

        if (!longitude || !latitude) {
            return res.status(400).json({ success: false, message: 'longitude and latitude required' });
        }

        const pipeline = [
            {
                $geoNear: {
                    near: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                    distanceField: 'dist.calculated',
                    maxDistance: parseFloat(radiusKm) * 1000,
                    spherical: true
                }
            }
        ];

        const places = await Place.aggregate(pipeline);

        if (places.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        const scoredPlaces = places.map(place => {
            const score = calculateCompositeScore(place, tags, place.dist.calculated);
            return { ...place, rankingScore: score };
        });

        scoredPlaces.sort((a, b) => b.rankingScore - a.rankingScore);
        const topPlaces = scoredPlaces.slice(0, parseInt(limit));

        if (topPlaces.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        const clustersMap = {};
        topPlaces.forEach(p => {
            const area = p.area || 'Nearby';
            if (!clustersMap[area]) {
                clustersMap[area] = { area, places: [] };
            }
            let notes = [];
            if (p.amenities?.food_nearby) notes.push('Good lunch stop nearby');
            if (p.amenities?.shopping_nearby) notes.push('Shopping available nearby');
            if (notes.length > 0) p.contextual_note = notes.join(' & ');
            clustersMap[area].places.push(p);
        });

        const finalClusters = [];
        for (const cluster of Object.values(clustersMap)) {
            if (cluster.places.length > 1) {
                try {
                    const coordsList = cluster.places.map(p => p.location.coordinates);
                    const matrix = await getDistanceMatrix(coordsList, 'walking');
                    const routeIndices = nearestNeighborWith2Opt(matrix, 0);
                    const orderedPlaces = routeIndices.map(idx => cluster.places[idx]);

                    orderedPlaces.forEach((p, routePos) => {
                        let walkMin = 0;
                        if (routePos < orderedPlaces.length - 1) {
                            const fromIdx = routeIndices[routePos];
                            const toIdx = routeIndices[routePos + 1];
                            const durationSec = matrix[fromIdx][toIdx];
                            if (durationSec) {
                                walkMin = Math.ceil(durationSec / 60);
                                p.walking_time_to_next = walkMin;
                            }
                        }
                        const walkStr = walkMin > 0 ? `👉 ${walkMin} min walk to next. ` : '';
                        const ctxNote = p.contextual_note ? `[${p.contextual_note}] ` : '';
                        p.description = p.description || {};
                        p.description.short = walkStr + ctxNote + (p.description.short || '');
                        if (!p.description.short) p.description.short = '';
                    });

                    cluster.places = orderedPlaces;
                } catch (err) {
                    console.error(`OSRM walking error for cluster ${cluster.area}:`, err.message);
                    cluster.places.forEach(p => {
                        p.description = p.description || {};
                        const ctxNote = p.contextual_note ? `[${p.contextual_note}] ` : '';
                        p.description.short = ctxNote + (p.description.short || '');
                    });
                }
            } else {
                let p = cluster.places[0];
                p.description = p.description || {};
                const ctxNote = p.contextual_note ? `[${p.contextual_note}] ` : '';
                p.description.short = ctxNote + (p.description.short || '');
            }
            finalClusters.push(cluster);
        }

        return res.status(200).json({ success: true, data: finalClusters });
    } catch (error) {
        console.error('Mode 1 Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch nearby places' });
    }
};

// ──────────────────────────────────────────
// MODE 2 — City-Wide LLM
// ──────────────────────────────────────────

/**
 * Maps pace string to max places per day
 */
const PACE_TO_MAX = { relaxed: 4, moderate: 5, packed: 6 };

// Excel stores open_days as 3-letter lowercase abbreviations
const DAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// These special values mean the place is open on all/any days
const ALWAYS_OPEN_VALUES = new Set(['all_days', 'event_based', 'seasonal', 'weekdays']);

/**
 * Get an array of 3-letter day abbreviations for the range [startDate, startDate+numDays)
 */
function getTravelDayAbbrs(startDate, numDays) {
    const abbrs = new Set();
    for (let i = 0; i < numDays; i++) {
        const d = new Date(startDate + 'T00:00:00');
        d.setDate(d.getDate() + i);
        abbrs.add(DAY_ABBR[d.getDay()]);
    }
    // Always include weekday abbrs to match 'weekdays' entries
    return [...abbrs];
}

export const generateCityWideItinerary = async (req, res) => {
    try {
        const {
            tags = [],
            numDays = 3,
            startDate,
            pace = 'moderate',        // relaxed | moderate | packed
            includeFood = true,
            includeShopping = true
        } = req.body;

        const maxPlacesPerDay = PACE_TO_MAX[pace] || 5;
        const DAILY_BUDGET_MIN = 420; // 7 hours
        const TRANSITION_BUFFER_MIN = 45;

        // ── Phase 1: Candidate Selection ────────────────────────────────────
        let query = {};
        if (tags.length > 0) {
            query.tags = { $in: tags.map(t => t.toLowerCase()) };
        }

        // Pull a manageable pool — open_days filter may reduce this further
        let allCandidates = await Place.find(query)
            .sort({ 'scores.cultural_score': -1, 'scores.popularity_score': -1 })
            .limit(30)
            .lean();

        // Filter by open_days if startDate is provided
        if (startDate) {
            const travelDayAbbrs = getTravelDayAbbrs(startDate, numDays);
            console.log(`[Mode2] Travel days (abbr): ${travelDayAbbrs.join(', ')}`);
            allCandidates = allCandidates.filter(p => {
                const openDays = p.visit_info?.open_days;
                // No open_days info → treat as always open
                if (!openDays || openDays.length === 0) return true;
                // Special values → always open
                if (openDays.some(d => ALWAYS_OPEN_VALUES.has(d.toLowerCase()))) return true;
                // weekdays special case: mon-fri
                if (openDays.includes('weekdays')) {
                    return travelDayAbbrs.some(d => ['mon','tue','wed','thu','fri'].includes(d));
                }
                // Check if any travel day matches
                return travelDayAbbrs.some(abbr => openDays.map(d => d.toLowerCase()).includes(abbr));
            });
            console.log(`[Mode2] Candidates after open_days filter: ${allCandidates.length}`);
        }

        // Limit to top 15 for LLM input (keeps prompt tiny → stays within free-tier quota)
        const candidates = allCandidates.slice(0, 15);

        if (candidates.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No places found matching your interests and travel dates.'
            });
        }

        // ── Phase 2: LLM Day Composition ────────────────────────────────────
        const cacheParams = { tags, numDays, startDate, pace };
        const rawDays = await composeDaysWithGemini(candidates, numDays, cacheParams);

        // ── Phase 3: Within-Day Ordering + Budget Enforcement ───────────────
        const itinerary = [];
        for (let i = 0; i < rawDays.length; i++) {
            const dayPlaceIds = rawDays[i];

            // Safe _id comparison (PlaceSchema uses String _id)
            let dayPlaces = dayPlaceIds
                .map(id => candidates.find(c => String(c._id) === String(id)))
                .filter(Boolean);

            // Enforce max places per day based on pace
            dayPlaces = dayPlaces.slice(0, maxPlacesPerDay);

            if (dayPlaces.length === 0) continue;

            // 420-min budget enforcement — drop lowest-scored place until under budget
            const enforceBudget = (places) => {
                let totalMin = places.reduce((sum, p) => sum + (p.visit_info?.avg_duration_min || 60), 0);
                totalMin += (places.length - 1) * TRANSITION_BUFFER_MIN; // transition buffers
                while (totalMin > DAILY_BUDGET_MIN && places.length > 1) {
                    // Remove the place with the lowest cultural + popularity score
                    let minIdx = 0;
                    let minScore = Infinity;
                    for (let j = 0; j < places.length; j++) {
                        const score = (places[j].scores?.cultural_score || 0) + (places[j].scores?.popularity_score || 0);
                        if (score < minScore) { minScore = score; minIdx = j; }
                    }
                    const dropped = places[minIdx];
                    console.log(`[Mode2 Budget] Day ${i + 1}: dropping "${dropped.name}" to stay under 420 min`);
                    places.splice(minIdx, 1);
                    totalMin = places.reduce((sum, p) => sum + (p.visit_info?.avg_duration_min || 60), 0);
                    totalMin += (places.length - 1) * TRANSITION_BUFFER_MIN;
                }
                return places;
            };

            dayPlaces = enforceBudget(dayPlaces);

            // Route via OSRM if more than 1 place
            if (dayPlaces.length > 1) {
                try {
                    const coords = dayPlaces.map(p => p.location.coordinates);
                    const matrix = await getDistanceMatrix(coords, 'driving');
                    const routeIndices = nearestNeighborWith2Opt(matrix, 0);
                    dayPlaces = routeIndices.map(idx => dayPlaces[idx]);

                    // Annotate travel times between stops
                    dayPlaces.forEach((p, pos) => {
                        if (pos < dayPlaces.length - 1) {
                            const fromIdx = routeIndices[pos];
                            const toIdx = routeIndices[pos + 1];
                            const driveSec = matrix[fromIdx][toIdx];
                            if (driveSec) {
                                p.drive_time_to_next_min = Math.ceil(driveSec / 60);
                            }
                        }
                    });
                } catch (err) {
                    console.warn(`[Mode2] OSRM routing failed for day ${i + 1}: ${err.message}. Using LLM order.`);
                }
            }

            // ── Phase 4: Food & Shopping injection ──────────────────────────
            let lunchTip = null;
            let shoppingTip = null;

            if (includeFood && dayPlaces.length > 2) {
                const midStops = [dayPlaces[1], dayPlaces[2]].filter(Boolean);
                const foodStop = midStops.find(p => p.amenities?.food_nearby);
                if (foodStop) {
                    lunchTip = `Lunch break — food available near ${foodStop.name}`;
                }
            }

            if (includeShopping && dayPlaces.length > 2) {
                const lateStops = dayPlaces.slice(Math.max(0, dayPlaces.length - 2));
                const shopStop = lateStops.find(p => p.amenities?.shopping_nearby);
                if (shopStop) {
                    shoppingTip = `Shopping available near ${shopStop.name} in the late afternoon`;
                }
            }

            itinerary.push({
                day: i + 1,
                date: startDate ? (() => {
                    const d = new Date(startDate + 'T00:00:00');
                    d.setDate(d.getDate() + i);
                    return d.toISOString().split('T')[0];
                })() : null,
                lunchTip,
                shoppingTip,
                places: dayPlaces
            });
        }

        return res.status(200).json({ success: true, data: itinerary });
    } catch (error) {
        console.error('Mode 2 Error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to generate city-wide itinerary' });
    }
};

// ──────────────────────────────────────────
// MODE 3 — Route Optimization
// ──────────────────────────────────────────
export const calculateOptimalRoute = async (req, res) => {
    try {
        const { selectedPlaceIds, startCoords = null } = req.body;

        if (!selectedPlaceIds || selectedPlaceIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No places selected' });
        }

        const places = await Place.find({ _id: { $in: selectedPlaceIds } }).lean();

        if (places.length === 0) {
            return res.status(404).json({ success: false, message: 'Places not found' });
        }

        let workablePlaces = [];
        let startIndex = 0;

        if (startCoords && startCoords.length === 2) {
            workablePlaces.push({
                _id: 'START_LOCATION',
                name: 'Your Start Location',
                location: { coordinates: startCoords },
                visit_info: { avg_duration_min: 0 }
            });
        }

        workablePlaces = [...workablePlaces, ...places];
        const coordsList = workablePlaces.map(p => p.location.coordinates);

        const matrix = await getDistanceMatrix(coordsList, 'driving');
        const bestRouteIndices = nearestNeighborWith2Opt(matrix, startIndex);
        const bestOrderedPlaces = bestRouteIndices.map(idx => workablePlaces[idx]);

        const rawDays = sliceIntoDays(bestOrderedPlaces, matrix, 420);
        const days = rawDays.map((placesArr, idx) => ({ day: idx + 1, places: placesArr }));

        const orderedCoords = bestOrderedPlaces.map(p => p.location.coordinates);
        let polylineData = null;
        if (orderedCoords.length > 1) {
            polylineData = await getRoutePath(orderedCoords, 'driving');
        }

        return res.status(200).json({
            success: true,
            days,
            polyline: polylineData ? polylineData.geometry : null,
            matrix
        });
    } catch (error) {
        console.error('Mode 3 Error:', error);
        res.status(500).json({ success: false, error: 'Failed to optimize route' });
    }
};
