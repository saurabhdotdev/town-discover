import { Place } from "@/types";

interface Centroid {
  lat: number;
  lng: number;
}

/**
 * Calculates Euclidean distance between coordinates.
 */
function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Clusters places into K groups using the K-Means++ algorithm.
 * Returns a mapping of Day (1-based index) to Place arrays.
 */
export function clusterPlacesKMeans(places: Place[], k: number): Record<number, Place[]> {
  const result: Record<number, Place[]> = {};
  
  // Initialize result structure
  for (let i = 1; i <= k; i++) {
    result[i] = [];
  }

  if (places.length === 0) return result;

  // Edge case: if number of places is less than or equal to k, assign one place per day
  if (places.length <= k) {
    places.forEach((place, index) => {
      result[index + 1] = [place];
    });
    return result;
  }

  // 1. Centroid Initialization using K-Means++
  const centroids: Centroid[] = [];
  
  // Select first centroid randomly
  const firstIndex = Math.floor(Math.random() * places.length);
  centroids.push({ lat: places[firstIndex].latitude, lng: places[firstIndex].longitude });

  // Select remaining k - 1 centroids
  while (centroids.length < k) {
    const distancesSq: number[] = [];
    let sumDistancesSq = 0;

    for (const place of places) {
      // Find distance to the nearest already chosen centroid
      let minDistance = Number.MAX_VALUE;
      for (const centroid of centroids) {
        const dist = getDistance(place.latitude, place.longitude, centroid.lat, centroid.lng);
        if (dist < minDistance) minDistance = dist;
      }
      const distSq = minDistance * minDistance;
      distancesSq.push(distSq);
      sumDistancesSq += distSq;
    }

    // Weighted random selection based on distance squared
    let r = Math.random() * sumDistancesSq;
    let nextIndex = 0;
    for (let i = 0; i < distancesSq.length; i++) {
      r -= distancesSq[i];
      if (r <= 0) {
        nextIndex = i;
        break;
      }
    }

    centroids.push({ lat: places[nextIndex].latitude, lng: places[nextIndex].longitude });
  }

  // 2. Iterative Optimization (K-Means)
  const maxIterations = 50;
  const tolerance = 1e-6;
  let assignments = new Array<number>(places.length).fill(-1);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    const newAssignments: number[] = [];

    // Assignment Step: assign each place to the nearest centroid
    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      let minCentroidIndex = 0;
      let minDistance = Number.MAX_VALUE;

      for (let c = 0; c < centroids.length; c++) {
        const dist = getDistance(place.latitude, place.longitude, centroids[c].lat, centroids[c].lng);
        if (dist < minDistance) {
          minDistance = dist;
          minCentroidIndex = c;
        }
      }

      if (assignments[i] !== minCentroidIndex) {
        changed = true;
      }
      newAssignments.push(minCentroidIndex);
    }

    assignments = newAssignments;

    // Update Step: recalculate centroids as the mean of assigned places
    const centroidSumsLat = new Array<number>(k).fill(0);
    const centroidSumsLng = new Array<number>(k).fill(0);
    const centroidCounts = new Array<number>(k).fill(0);

    for (let i = 0; i < places.length; i++) {
      const c = assignments[i];
      centroidSumsLat[c] += places[i].latitude;
      centroidSumsLng[c] += places[i].longitude;
      centroidCounts[c]++;
    }

    let centroidMovement = 0;
    for (let c = 0; c < k; c++) {
      if (centroidCounts[c] > 0) {
        const newLat = centroidSumsLat[c] / centroidCounts[c];
        const newLng = centroidSumsLng[c] / centroidCounts[c];
        centroidMovement += getDistance(centroids[c].lat, centroids[c].lng, newLat, newLng);
        centroids[c] = { lat: newLat, lng: newLng };
      } else {
        // Handle empty cluster by reinitializing centroid to a random place
        const randIdx = Math.floor(Math.random() * places.length);
        centroids[c] = { lat: places[randIdx].latitude, lng: places[randIdx].longitude };
        changed = true;
      }
    }

    // Break early if centroids did not move significantly
    if (!changed || centroidMovement < tolerance) {
      break;
    }
  }

  // 3. Sort Clusters by sequence of travel (from nearest to furthest from the starting point)
  // Let the starting reference point be the first centroid or coordinates of the first place
  const startRef = { lat: places[0].latitude, lng: places[0].longitude };
  const sortedClusterIndices = Array.from({ length: k }, (_, i) => i)
    .map(cIndex => ({
      cIndex,
      dist: getDistance(centroids[cIndex].lat, centroids[cIndex].lng, startRef.lat, startRef.lng)
    }))
    .sort((a, b) => a.dist - b.dist)
    .map(item => item.cIndex);

  // 4. Map place assignments to Day index (Day 1 for closest cluster, Day 2 for next, etc.)
  for (let i = 0; i < places.length; i++) {
    const cIndex = assignments[i];
    // Find the sorted day rank (1-based index)
    const dayRank = sortedClusterIndices.indexOf(cIndex) + 1;
    result[dayRank].push(places[i]);
  }

  // Sort places inside each day's itinerary by rating descending (so premium places are selected first)
  for (let day = 1; day <= k; day++) {
    result[day] = result[day].sort((a, b) => b.rating - a.rating);
  }

  return result;
}
