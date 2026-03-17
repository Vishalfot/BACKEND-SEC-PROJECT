import axios from 'axios';

const OSRM_BASE_URL = 'http://router.project-osrm.org';

/**
 * Fetch a distance/duration matrix from OSRM
 * @param {Array<[number, number]>} coordinates - Array of [longitude, latitude]
 * @param {string} profile - 'driving' or 'walking'
 * @returns {Promise<number[][]>} Matrix of durations in seconds
 */
export const getDistanceMatrix = async (coordinates, profile = 'driving') => {
  try {
    const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    // Need annotations=duration to get travel times
    const url = `${OSRM_BASE_URL}/table/v1/${profile}/${coordString}?annotations=duration`;
    
    const response = await axios.get(url);
    if (response.data.code !== 'Ok') {
      throw new Error(`OSRM Error: ${response.data.code}`);
    }
    
    return response.data.durations;
  } catch (error) {
    console.error('OSRM Matrix API Error:', error.message);
    throw error;
  }
};

/**
 * Fetch the actual route polyline from OSRM
 * @param {Array<[number, number]>} coordinates - Array of [longitude, latitude] in desired visit order
 * @param {string} profile - 'driving' or 'walking'
 */
export const getRoutePath = async (coordinates, profile = 'driving') => {
  try {
    const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const url = `${OSRM_BASE_URL}/route/v1/${profile}/${coordString}?overview=full&geometries=geojson`;
    
    const response = await axios.get(url);
    if (response.data.code !== 'Ok') {
      throw new Error(`OSRM Error: ${response.data.code}`);
    }
    
    return response.data.routes[0];
  } catch (error) {
    console.error('OSRM Route API Error:', error.message);
    throw error;
  }
};

/**
 * Custom 2-opt implementation to optimize Nearest Neighbor results
 * @param {number[]} route - Current indices
 * @param {number[][]} matrix - Duration matrix
 * @returns {number[]} Optimized route
 */
const optimize2Opt = (route, matrix) => {
  let improved = true;
  let bestRoute = [...route];
  let bestDistance = calculateTotalDistance(bestRoute, matrix);

  while (improved) {
    improved = false;
    for (let i = 1; i < bestRoute.length - 1; i++) {
        // Only inner nodes reversed (keeping start [0] and end intact if it's an open route)
        // Actually, for an open TSP without returning to start, we can still reverse segments.
        // But normally 2-opt reverses i to k. Let's do simple i to k reversal.
      for (let k = i + 1; k < bestRoute.length; k++) {
        const newRoute = [...bestRoute];
        const reversedSegment = bestRoute.slice(i, k + 1).reverse();
        newRoute.splice(i, k - i + 1, ...reversedSegment);
        
        const newDistance = calculateTotalDistance(newRoute, matrix);
        if (newDistance < bestDistance) {
          bestDistance = newDistance;
          bestRoute = newRoute;
          improved = true;
        }
      }
    }
  }
  return bestRoute;
};

const calculateTotalDistance = (route, matrix) => {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += matrix[route[i]][route[i + 1]];
  }
  return total;
};

/**
 * Calculate Nearest Neighbor start + 2 opt
 * @param {number[][]} matrix 
 * @param {number} startIndex 
 */
export const nearestNeighborWith2Opt = (matrix, startIndex = 0) => {
    const numPlaces = matrix.length;
    const visited = new Set([startIndex]);
    let route = [startIndex];
    
    let current = startIndex;
    while (visited.size < numPlaces) {
        let nearest = -1;
        let minDistance = Infinity;
        
        for (let i = 0; i < numPlaces; i++) {
            if (!visited.has(i)) {
                // Ignore nulls/Infinity from OSRM
                const dist = matrix[current][i]; 
                if (dist !== null && dist < minDistance) {
                    minDistance = dist;
                    nearest = i;
                }
            }
        }
        
        if (nearest === -1) {
            // Failsafe if matrix is disconnected
            // Pick any remaining
            for (let i = 0; i < numPlaces; i++) {
                if (!visited.has(i)) {
                    nearest = i;
                    break;
                }
            }
        }
        
        visited.add(nearest);
        route.push(nearest);
        current = nearest;
    }
    
    // Apply 2-opt optimization
    if (route.length > 3) {
        route = optimize2Opt(route, matrix);
    }
    
    return route;
};
