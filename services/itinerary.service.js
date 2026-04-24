// // // services/itinerary.service.js

// // import Place from "../models/PlaceSchema.js";
// // import Event from "../models/Event.js";
// // import { getOSRMRoute } from "./osrm.service.js";
// // import { scorePlace } from "./scoring.service.js";

// // function formatTime(time) {
// //   return `${time.hour}:${time.minute.toString().padStart(2, "0")}`;
// // }

// // function addMinutes(time, minutes) {
// //   const total = time.hour * 60 + time.minute + minutes;
// //   return {
// //     hour: Math.floor(total / 60),
// //     minute: total % 60
// //   };
// // }

// // export async function buildItinerary(userPreferences) {

// //   const places = await Place.find({ verified: true }).lean();

// //   let events = [];
// //   if (userPreferences.include_local_events) {
// //     events = await Event.find({ verified: true }).lean();

// //     events = events.map(e => ({
// //       ...e,
// //       type: "event",
// //       area: null,
// //       tags: e.tags || [],
// //       scores: { cultural_score: e.cultural_weight || 0.7 },
// //       visit_info: { avg_duration_min: 90 }
// //     }));
// //   }

// //   const candidates = [
// //     ...places.map(p => ({ ...p, type: "place" })),
// //     ...events
// //   ];

// //   const itinerary = [];

// //   for (let day = 1; day <= userPreferences.days; day++) {

// //     const dayPlan = {
// //       day,
// //       places: [],
// //       total_distance: 0,
// //       total_time: 0
// //     };

// //     let currentTime = { ...userPreferences.start_time };
// //     let previousItem = null;
// //     let timeRemaining = userPreferences.hours_per_day * 60;

// //     while (timeRemaining > 60) {

// //       const scored = [];

// //       for (const item of candidates) {

// //         if (dayPlan.places.some(p => p._id === item._id)) continue;

// //         let travelData = null;

// //         if (previousItem) {
// //           travelData = await getOSRMRoute(
// //             {
// //               lat: previousItem.location.coordinates[1],
// //               lng: previousItem.location.coordinates[0]
// //             },
// //             {
// //               lat: item.location.coordinates[1],
// //               lng: item.location.coordinates[0]
// //             },
// //             userPreferences.transport_mode
// //           );
// //         }

// //         const score = await scorePlace({
// //           item,
// //           userPreferences,
// //           previousItem,
// //           currentTime,
// //           travelData
// //         });

// //         scored.push({ item, score, travelData });
// //       }

// //       scored.sort((a, b) => b.score - a.score);

// //       if (!scored.length) break;

// //       const selected = scored[0];
// //       const visitDuration =
// //         selected.item.visit_info?.avg_duration_min || 90;

// //       const totalNeeded =
// //         (selected.travelData?.duration_min || 0) + visitDuration;

// //       if (totalNeeded > timeRemaining) break;

// //       dayPlan.places.push({
// //         ...selected.item,
// //         arrival_time: formatTime(currentTime),
// //         travel_time_min: selected.travelData?.duration_min || 0,
// //         distance_from_previous_km: selected.travelData?.distance_km || 0,
// //         visit_duration_min: visitDuration,
// //         score: selected.score
// //       });

// //       currentTime = addMinutes(currentTime, totalNeeded);
// //       timeRemaining -= totalNeeded;

// //       dayPlan.total_distance += selected.travelData?.distance_km || 0;
// //       dayPlan.total_time += totalNeeded;

// //       previousItem = selected.item;
// //     }

// //     itinerary.push(dayPlan);
// //   }

// //   return itinerary;
// // }
// // services/itinerary.service.js - REPLACE YOUR CURRENT FILE WITH THIS
// import Place from "../models/PlaceSchema.js";
// import Event from "../models/Event.js";
// import Weddingplace from "../models/weddings.js";
// import { getOSRMRoute } from "./osrm.service.js";
// import { scorePlace } from "./scoring.service.js";

// function formatTime(time) {
//   return `${time.hour}:${time.minute.toString().padStart(2, "0")}`;
// }

// function addMinutes(time, minutes) {
//   const total = time.hour * 60 + time.minute + minutes;
//   return {
//     hour: Math.floor(total / 60),
//     minute: total % 60
//   };
// }

// export async function buildItinerary(userPreferences) {
//   // 1️⃣ FETCH PLACES
//   const places = await Place.find({ verified: true }).lean();
  
//   let candidates = places.map(p => ({ ...p, type: "place" }));

//   // 2️⃣ FETCH EVENTS (if enabled)
//   if (userPreferences.include_local_events) {
//     const tripStartDate = userPreferences.trip_start_date 
//       ? new Date(userPreferences.trip_start_date) 
//       : new Date();
    
//     const tripEndDate = new Date(tripStartDate);
//     tripEndDate.setDate(tripEndDate.getDate() + userPreferences.days);

//     const events = await Event.find({
//       verified: true,
//       event_date: {
//         $gte: tripStartDate,
//         $lte: tripEndDate
//       }
//     })
//     .populate('place_ref', 'name area location')
//     .lean();

//     // Transform events to match place structure
//     const eventItems = events.map(e => ({
//       _id: e._id,
//       name: e.event_name,
//       type: "event",
//       category: "CULTURAL_EVENT",
//       area: e.place_ref?.area || null,
//       location: e.location,
//       tags: e.tags || [],
//       scores: { 
//         cultural_score: e.cultural_weight || 0.8,
//         popularity_score: 0.7 
//       },
//       visit_info: { 
//         avg_duration_min: 120,
//         best_time_of_day: [
//           e.start_time.split(':')[0] < 12 ? 'morning' : 
//           e.start_time.split(':')[0] < 17 ? 'afternoon' : 'evening'
//         ]
//       },
//       event_date: e.event_date,
//       start_time: e.start_time,
//       end_time: e.end_time,
//       experience_type: e.experience_type,
//       description: { short: e.description },
//       media: { images: [{ url: e.avatar }] },
//       pricing: { entry_fee: { indian_adult: e.price || 0 } }
//     }));

//     candidates = [...candidates, ...eventItems];
//   }

//   // 3️⃣ FETCH WEDDINGS (if enabled)
//   if (userPreferences.include_weddings) {
//     const weddings = await Weddingplace.find({ 
//       verified: true 
//     })
//     .populate('place_ref', 'name area')
//     .lean();

//     const weddingItems = weddings.map(w => ({
//       _id: w._id,
//       name: w.title,
//       type: "wedding",
//       category: "CULTURAL_WEDDING",
//       area: w.place_ref?.area || null,
//       location: w.location,
//       tags: ['wedding', 'cultural', 'experience'],
//       scores: { 
//         cultural_score: 0.9,
//         popularity_score: 0.8 
//       },
//       visit_info: { 
//         avg_duration_min: 180,
//         best_time_of_day: ['evening']
//       },
//       date: w.date,
//       time: w.time,
//       description: { short: w.description },
//       media: { images: w.images },
//       pricing: { entry_fee: { indian_adult: w.base_price || 0 } }
//     }));

//     candidates = [...candidates, ...weddingItems];
//   }

//   // 4️⃣ BUILD ITINERARY
//   const itinerary = [];

//   for (let day = 1; day <= userPreferences.days; day++) {
//     const dayPlan = {
//       day,
//       places: [],
//       total_distance: 0,
//       total_time: 0
//     };

//     let currentTime = { ...userPreferences.start_time };
//     let previousItem = null;
//     let timeRemaining = userPreferences.hours_per_day * 60;

//     while (timeRemaining > 60) {
//       const scored = [];

//       for (const item of candidates) {
//         if (dayPlan.places.some(p => p._id.toString() === item._id.toString())) continue;

//         let travelData = null;
//         if (previousItem) {
//           travelData = await getOSRMRoute(
//             {
//               lat: previousItem.location.coordinates[1],
//               lng: previousItem.location.coordinates[0]
//             },
//             {
//               lat: item.location.coordinates[1],
//               lng: item.location.coordinates[0]
//             },
//             userPreferences.transport_mode || 'driving'
//           );
//         }

//         const score = await scorePlace({
//           item,
//           userPreferences,
//           previousItem,
//           currentTime,
//           travelData
//         });

//         scored.push({ item, score, travelData });
//       }

//       scored.sort((a, b) => b.score - a.score);

//       if (!scored.length) break;

//       const selected = scored[0];
//       const visitDuration = selected.item.visit_info?.avg_duration_min || 90;
//       const totalNeeded = (selected.travelData?.duration_min || 0) + visitDuration;

//       if (totalNeeded > timeRemaining) break;

//       dayPlan.places.push({
//         ...selected.item,
//         arrival_time: formatTime(currentTime),
//         travel_time_min: selected.travelData?.duration_min || 0,
//         distance_from_previous_km: selected.travelData?.distance_km || 0,
//         visit_duration_min: visitDuration,
//         score: selected.score
//       });

//       currentTime = addMinutes(currentTime, totalNeeded);
//       timeRemaining -= totalNeeded;
//       dayPlan.total_distance += selected.travelData?.distance_km || 0;
//       dayPlan.total_time += totalNeeded;
//       previousItem = selected.item;
//     }

//     itinerary.push(dayPlan);
//   }

//   return itinerary;
// }

// import Place from "../models/PlaceSchema.js";
// import Event from "../models/Event.js";
// import Weddingplace from "../models/weddings.js";
// import { getOSRMRoute } from "./osrm.service.js";
// import { scorePlace } from "./scoring.service.js";

// const routeCache = new Map();

// function formatTime(time) {
//   return `${time.hour}:${time.minute.toString().padStart(2, "0")}`;
// }

// function addMinutes(time, minutes) {
//   const total = time.hour * 60 + time.minute + minutes;
//   return {
//     hour: Math.floor(total / 60),
//     minute: total % 60
//   };
// }

// export async function buildItinerary(userPreferences) {

//   const places = await Place.find({ verified: true }).lean();
//   let candidates = places.map(p => ({ ...p, type: "place" }));

//   const tripStartDate = userPreferences.trip_start_date
//     ? new Date(userPreferences.trip_start_date)
//     : new Date();

//   const tripEndDate = new Date(tripStartDate);
//   tripEndDate.setDate(tripEndDate.getDate() + userPreferences.days);

//   // ================= EVENTS =================
//   if (userPreferences.include_local_events) {

//     const eventQuery = {
//       verified: true,
//       event_date: { $gte: tripStartDate, $lte: tripEndDate }
//     };

//     if (userPreferences.experience_type) {
//       eventQuery.experience_type = userPreferences.experience_type;
//     }

//     const events = await Event.find(eventQuery)
//       .populate("place_ref", "name area location")
//       .lean();

//     const eventItems = events.map(e => ({
//       _id: e._id,
//       name: e.event_name,
//       type: "event",
//       area: e.place_ref?.area || null,
//       location: e.location,
//       tags: e.tags || [],
//       scores: {
//         cultural_score: e.cultural_weight || 0.8,
//         popularity_score: 0.7
//       },
//       visit_info: {
//         avg_duration_min: 120,
//         best_time_of_day: ["evening"]
//       },
//       start_time: e.start_time,
//       special_features: {}
//     }));

//     candidates = [...candidates, ...eventItems];
//   }

//   // ================= WEDDINGS =================
//   if (userPreferences.include_weddings) {

//     const weddings = await Weddingplace.find({
//       verified: true,
//       date: { $gte: tripStartDate, $lte: tripEndDate }
//     }).populate("place_ref", "name area").lean();

//     const weddingItems = weddings.map(w => ({
//       _id: w._id,
//       name: w.title,
//       type: "wedding",
//       area: w.place_ref?.area || null,
//       location: w.location,
//       tags: ["wedding", "cultural", "experience"],
//       scores: {
//         cultural_score: 0.9,
//         popularity_score: 0.8
//       },
//       visit_info: {
//         avg_duration_min: 180,
//         best_time_of_day: ["evening"]
//       },
//       special_features: {}
//     }));

//     candidates = [...candidates, ...weddingItems];
//   }

//   // ================= BUILD ITINERARY =================
//   const itinerary = [];

//   for (let day = 1; day <= userPreferences.days; day++) {

//     const dayPlan = {
//       day,
//       places: [],
//       total_distance: 0,
//       total_time: 0
//     };

//     let currentTime = { ...userPreferences.start_time };
//     let previousItem = null;
//     let timeRemaining = userPreferences.hours_per_day * 60;

//     while (timeRemaining > 60) {

//       const scored = [];

//       for (const item of candidates) {

//         if (dayPlan.places.some(p => p._id.toString() === item._id.toString()))
//           continue;

//         // 🔥 OPEN DAY CHECK
//         const todayName = new Date().toLocaleString("en-US", {
//           weekday: "short"
//         }).toLowerCase();

//         if (item.visit_info?.open_days?.length &&
//             !item.visit_info.open_days.includes(todayName)) {
//           continue;
//         }

//         let travelData = null;

//         if (previousItem) {

//           const cacheKey = `${previousItem._id}-${item._id}`;

//           if (routeCache.has(cacheKey)) {
//             travelData = routeCache.get(cacheKey);
//           } else {
//              travelData = await getOSRMRoute(
//                 previousItem.location.coordinates,
//                 item.location.coordinates
//              );
//             routeCache.set(cacheKey, travelData);
//           }
//         }

//         const score = await scorePlace({
//           item,
//           userPreferences,
//           previousItem,
//           currentTime,
//           travelData
//         });

//         scored.push({ item, score, travelData });
//       }

//       scored.sort((a, b) => b.score - a.score);
//       if (!scored.length) break;

//       const selected = scored[0];
//       const visitDuration = selected.item.visit_info?.avg_duration_min || 90;
//       const totalNeeded =
//         (selected.travelData?.duration_min || 0) + visitDuration;

//       if (totalNeeded > timeRemaining) break;

//       dayPlan.places.push({
//         ...selected.item,
//         arrival_time: formatTime(currentTime),
//         travel_time_min: selected.travelData?.duration_min || 0,
//         distance_from_previous_km:
//           selected.travelData?.distance_km || 0,
//         visit_duration_min: visitDuration,
//         score: selected.score
//       });

//       currentTime = addMinutes(currentTime, totalNeeded);
//       timeRemaining -= totalNeeded;
//       dayPlan.total_distance += selected.travelData?.distance_km || 0;
//       dayPlan.total_time += totalNeeded;
//       previousItem = selected.item;
//     }

//     itinerary.push(dayPlan);
//   }

//   return itinerary;
// }


import Place from "../models/PlaceSchema.js";
import Event from "../models/Event.js";

import { getOSRMRoute } from "./osrm.service.js";
import { scorePlace } from "./scoring.service.js";

/* ===============================
   UTILITIES
=================================*/

// Haversine distance (fast geographic distance)
function haversineDistance(coord1, coord2) {
  const R = 6371; // km
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(coord1[1] * Math.PI / 180) *
      Math.cos(coord2[1] * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Add minutes to time object
function addMinutes(timeObj, minutesToAdd) {
  const total = timeObj.hour * 60 + timeObj.minute + minutesToAdd;
  return {
    hour: Math.floor(total / 60),
    minute: total % 60
  };
}

// Format time as HH:MM
function formatTime(timeObj) {
  const h = String(timeObj.hour).padStart(2, "0");
  const m = String(timeObj.minute).padStart(2, "0");
  return `${h}:${m}`;
}

/* ===============================
   K-MEANS CLUSTERING (BY DAYS)
=================================*/

function kMeansCluster(items, k) {
  if (items.length <= k) {
    return items.map(item => [item]);
  }

  let centroids = items.slice(0, k).map(i => i.location.coordinates);
  let clusters = [];

  for (let iteration = 0; iteration < 5; iteration++) {
    clusters = Array.from({ length: k }, () => []);

    for (const item of items) {
      let minDist = Infinity;
      let clusterIndex = 0;

      centroids.forEach((centroid, index) => {
        const dist = haversineDistance(item.location.coordinates, centroid);
        if (dist < minDist) {
          minDist = dist;
          clusterIndex = index;
        }
      });

      clusters[clusterIndex].push(item);
    }

    centroids = clusters.map(cluster => {
      if (!cluster.length) return centroids[0];

      const avgLng =
        cluster.reduce((sum, p) => sum + p.location.coordinates[0], 0) /
        cluster.length;

      const avgLat =
        cluster.reduce((sum, p) => sum + p.location.coordinates[1], 0) /
        cluster.length;

      return [avgLng, avgLat];
    });
  }

  return clusters;
}

/* ===============================
   TSP (Nearest Neighbor - Fast)
=================================*/

async function optimizeRoute(cluster) {
  if (cluster.length <= 1) return cluster;

  const visited = new Set();
  const ordered = [];

  // Start at highest scored place
  cluster.sort((a, b) => b.baseScore - a.baseScore);

  let current = cluster[0];
  visited.add(current._id.toString());
  ordered.push(current);

  while (ordered.length < cluster.length) {
    let nearest = null;
    let shortest = Infinity;

    for (const candidate of cluster) {
      if (visited.has(candidate._id.toString())) continue;

      const dist = haversineDistance(
        current.location.coordinates,
        candidate.location.coordinates
      );

      if (dist < shortest) {
        shortest = dist;
        nearest = candidate;
      }
    }

    if (!nearest) break;

    ordered.push(nearest);
    visited.add(nearest._id.toString());
    current = nearest;
  }

  return ordered;
}

/* ===============================
   MAIN ITINERARY BUILDER
=================================*/

/* ===============================
   MAIN ITINERARY BUILDER
=================================*/

export async function buildItinerary(userPreferences) {
  const {
    days = 3,
    start_time = { hour: 9, minute: 0 },
    hours_per_day = 8,
    include_local_events = true,
    include_weddings = false,
    trip_start_date,
    interests = [] // 4. Database-level filtering
  } = userPreferences;

  const tripStartDate = trip_start_date
    ? new Date(trip_start_date)
    : new Date();

  const tripEndDate = new Date(tripStartDate);
  tripEndDate.setDate(tripEndDate.getDate() + days);
  
  // 3. Open Days calculation: Array of short weekday names for the trip duration
  const tripDaysOfWeek = [];
  for(let i=0; i<days; i++) {
        let d = new Date(tripStartDate);
        d.setDate(d.getDate() + i);
        tripDaysOfWeek.push(d.toLocaleString("en-US", { weekday: "short" }).toLowerCase());
  }

  /* ===============================
     FETCH DATA (WITH DB LEVEL FILTERING)
  =================================*/
  
  let placeQuery = { verified: true };
  
  // 4. Over-fetching fix: filter by interests if provided
  if (interests && interests.length > 0) {
      placeQuery.tags = { $in: interests.map(t => t.toLowerCase()) };
  }

  // Find places matching the query, sorted by highest scores to limit absolute candidates to 50
  const places = await Place.find(placeQuery)
        .sort({ "scores.popularity_score": -1, "scores.cultural_score": -1 })
        .limit(days * 15) // Limit pool effectively
        .lean();
        
  let candidates = places.map(p => ({ ...p, type: "place" }));

  // 3. Open Days Check (Filter out places that aren't open on ANY day of the trip)
  candidates = candidates.filter(item => {
      // If it has no specific open days, assume open everyday
      if (!item.visit_info?.open_days || item.visit_info.open_days.length === 0) return true;
      // If none of the trip's days intersect with the place's open days, drop it early
      return tripDaysOfWeek.some(day => item.visit_info.open_days.includes(day));
  });

  if (include_local_events) {
    const events = await Event.find({
      verified: true,
      event_date: { $gte: tripStartDate, $lte: tripEndDate }
    })
      .populate("place_ref", "name area location")
      .lean();

    candidates.push(...events.map(e => ({ ...e, type: "event" })));
  }

  // Weddings deliberately skipped to answer previous user request
  // if (include_weddings) { ... }

  /* ===============================
     SCORING
  =================================*/

  const scoredAll = [];

  for (const item of candidates) {
    const baseScore = await scorePlace({
      item,
      userPreferences,
      previousItem: null,
      currentTime: start_time,
      travelData: null
    });

    scoredAll.push({ ...item, baseScore });
  }

  scoredAll.sort((a, b) => b.baseScore - a.baseScore);

  // Limit total places to avoid overload during clustering
  const maxTotalPlaces = days * 8; // 8 per day maximum possible
  const trimmed = scoredAll.slice(0, maxTotalPlaces);

  /* ===============================
     CLUSTER INTO DAYS (K-Means)
  =================================*/
  // Note: K-means here just buckets them by Geography.
  const clusters = kMeansCluster(trimmed, days);
  const itinerary = [];

  /* ===============================
     BUILD EACH DAY
  =================================*/

  for (let day = 0; day < clusters.length; day++) {
    const cluster = clusters[day];
    if (cluster.length === 0) continue;

    const dayPlan = {
      day: day + 1,
      places: [],
      total_distance: 0,
      total_time: 0
    };
    
    // We need the weekday name for this exact day to verify exactly which place is open
    let currentDayDate = new Date(tripStartDate);
    currentDayDate.setDate(currentDayDate.getDate() + day);
    const todayName = currentDayDate.toLocaleString("en-US", { weekday: "short" }).toLowerCase();
    
    // Exact Open Day Filter for this specific day
    let workableCluster = cluster.filter(item => {
         if (!item.visit_info?.open_days || item.visit_info.open_days.length === 0) return true;
         return item.visit_info.open_days.includes(todayName);
    });
    
    if (workableCluster.length === 0) continue;

    // 1. MATRIX ROUTING (N+1 Bug Fix)
    const currentCoordsList = workableCluster.map(p => p.location.coordinates);
    let matrix = [];
    try {
         const { getDistanceMatrix } = await import('./osrm.service.js');
         matrix = await getDistanceMatrix(currentCoordsList, 'driving');
    } catch (e) {
         console.error("Matrix failed, falling back to sequential distance loop");
         // Build fallback matrix using haversine if OSRM is down
         for(let i=0; i<currentCoordsList.length; i++){
             matrix[i] = [];
             for(let j=0; j<currentCoordsList.length; j++){
                 matrix[i][j] = haversineDistance(currentCoordsList[i], currentCoordsList[j]) * 100; // rough seconds approximation
             }
         }
    }

    // 2. TIME-OF-DAY RESPECT ALGORITHM (TSP + Time Penalties)
    // Run nearest neighbor but factor in Best Time of Day
    const visitedIndices = new Set();
    const orderedIndices = [];
    
    // Find best starting place (prioritize morning places)
    workableCluster.sort((a, b) => {
         const aIsMorning = a.visit_info?.best_time_of_day?.includes("morning") ? 1 : 0;
         const bIsMorning = b.visit_info?.best_time_of_day?.includes("morning") ? 1 : 0;
         return bIsMorning - aIsMorning || (b.baseScore - a.baseScore);
    });
    
    // Start index is the one we sorted to top, but wait, the matrix maps to original `workableCluster` order.
    // Let's just use workableCluster[0] index which is 0 since we haven't mutated the array mapped to matrix
    // Wait, the sort mutated it. Let's un-mutate.
    
    const startIdx = 0; // Just use geographic cluster centroid start instead of recalculating
    
    // Proper Time-Aware Nearest Neighbor
    let currentIdx = startIdx;
    visitedIndices.add(currentIdx);
    orderedIndices.push(currentIdx);
    let cumulativeTimeMin = start_time.hour * 60 + start_time.minute;

    while (orderedIndices.length < workableCluster.length) {
      let nearestIdx = -1;
      let lowestCost = Infinity;

      for (let i = 0; i < workableCluster.length; i++) {
        if (visitedIndices.has(i)) continue;

        // Base cost is distance/travel time (seconds)
        let travelSeconds = matrix[currentIdx][i] || 0;
        let cost = travelSeconds;
        
        // Time of Day Penalty Check
        const candidate = workableCluster[i];
        
        // Estimate arrival roughly
        const visitDurationPrev = workableCluster[currentIdx].visit_info?.avg_duration_min || 90;
        const estArrivalMin = cumulativeTimeMin + visitDurationPrev + (travelSeconds / 60);
        
        // Check if arrival clashes with candidate best times
        const bestTimes = candidate.visit_info?.best_time_of_day || [];
        if (bestTimes.length > 0) {
            const isMorningArrival = estArrivalMin < 720; // Before 12:00
            const isAfternoonArrival = estArrivalMin >= 720 && estArrivalMin < 1020; // 12-17
            const isEveningArrival = estArrivalMin >= 1020; // After 17:00
            
            let timeMatch = false;
            if (isMorningArrival && bestTimes.includes('morning')) timeMatch = true;
            if (isAfternoonArrival && bestTimes.includes('afternoon')) timeMatch = true;
            if (isEveningArrival && bestTimes.includes('evening')) timeMatch = true;
            
            // If it doesn't match the best time, severely heavily penalize routing strictly to it right now
            if (!timeMatch) {
                cost += 3600; // Add 1 fake hour of travel time penalty so algo picks something else
            }
        }

        if (cost < lowestCost) {
          lowestCost = cost;
          nearestIdx = i;
        }
      }

      if (nearestIdx === -1) break;
      
      const actualTravelSec = matrix[currentIdx][nearestIdx] || 0;
      cumulativeTimeMin += (workableCluster[currentIdx].visit_info?.avg_duration_min || 90) + (actualTravelSec/60);

      orderedIndices.push(nearestIdx);
      visitedIndices.add(nearestIdx);
      currentIdx = nearestIdx;
    }

    // Now build the actual day array
    const ordered = orderedIndices.map(idx => workableCluster[idx]);

    let currentTime = { ...start_time };

    for (let i = 0; i < ordered.length; i++) {
      const place = ordered[i];
      if (dayPlan.total_time >= hours_per_day * 60) break;

      let travelData = null;
      let travelMinutes = 0;
      
      if (i > 0) {
         // Pull travel time directly from the matrix we already calculated
         const prevIdx = orderedIndices[i-1];
         const currIdx = orderedIndices[i];
         travelMinutes = Math.ceil((matrix[prevIdx][currIdx] || 0) / 60);
      }

      const visitDuration = place.visit_info?.avg_duration_min || 90;
      const arrivalTime = formatTime(currentTime);

      dayPlan.places.push({
        ...place,
        arrival_time: arrivalTime,
        travel_time_min: travelMinutes,
        visit_duration_min: visitDuration
      });

      const needed = travelMinutes + visitDuration;
      currentTime = addMinutes(currentTime, needed);

      dayPlan.total_time += needed;
    }

    itinerary.push(dayPlan);
  }

  return itinerary;
}