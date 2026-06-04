import { Place, SupportedCityName } from '@/types';
import { CITY_BOUNDS } from '@/lib/pune-location';
import { getCache, setCache } from '@/lib/redis';
import { fetchLivePlacesByBounds } from '@/lib/live-places';

/**
 * Fetch live places from OpenStreetMap Overpass API for a given city bounding box.
 * Returns an array of Place objects mapping standard categories and synthetic ratings.
 */
export async function fetchLivePlacesByCity(city: SupportedCityName): Promise<Place[]> {
  const cacheKey = `places:osm:${city.toLowerCase()}`;
  const cached = await getCache<Place[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const bounds = CITY_BOUNDS[city];
  if (!bounds) {
    throw new Error(`No bounding box coordinates defined for city: ${city}`);
  }

  const places = await fetchLivePlacesByBounds({
    south: bounds.minLatitude,
    west: bounds.minLongitude,
    north: bounds.maxLatitude,
    east: bounds.maxLongitude,
  });

  // Ensure all places have the correct city field and limit to 150 items
  const cityPlaces = places.slice(0, 150).map((place) => ({
    ...place,
    city,
  }));

  await setCache(cacheKey, cityPlaces, 600); // 10 minutes cache
  return cityPlaces;
}
