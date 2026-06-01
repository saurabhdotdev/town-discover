import { SupportedCityName } from "@/lib/pune-location";
import { Place } from "@/types";

export const getFallbackPlacesForCity = async (city: SupportedCityName): Promise<Place[]> => {
  try {
    const res = await fetch(`/api/places/fallback?city=${encodeURIComponent(city)}`);
    if (!res.ok) throw new Error("Failed to fetch fallback places");
    const data = await res.json();
    return data.places;
  } catch (err) {
    console.error("Client fallback fetch failed, using local mock data:", err);
    // Hard fallback to mock places on the client if API fails
    const { MOCK_PLACES } = await import("@/data/mock-places");
    return MOCK_PLACES.filter((p) => p.city === city);
  }
};
