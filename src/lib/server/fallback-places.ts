import { SupportedCityName } from "@/lib/pune-location";
import { Place } from "@/types";
import { fetchLivePlacesByCity } from "@/lib/live-places-by-city";
import { fetchLiveTownEvents } from "@/lib/town-events";
import { mergePlaces } from "@/lib/merge-places";
import { MOCK_PLACES } from "@/data/mock-places";

export const getFallbackPlacesForCity = async (city: SupportedCityName): Promise<Place[]> => {
  // Try live OSM data first
  try {
    const livePlaces = await fetchLivePlacesByCity(city);
    // If we have a healthy number of live results, return them (merged with events)
    if (livePlaces.length >= 30) {
      const townEvents = await fetchLiveTownEvents(city);
      return mergePlaces(livePlaces, townEvents);
    }
    // Otherwise fall back to mock data
  } catch (e) {
    // Swallow errors – fallback to mock data
  }
  const cityPlaces = MOCK_PLACES.filter((place) => place.city === city);
  const townEvents = await fetchLiveTownEvents(city);
  return mergePlaces(cityPlaces, townEvents);
};
