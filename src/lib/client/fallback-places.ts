import { SupportedCityName } from "@/lib/pune-location";
import { Place } from "@/types";

export const getFallbackPlacesForCity = async (city: SupportedCityName): Promise<Place[]> => {
  const cacheKey = `sheher:fallback:v3:${city.toLowerCase()}`;
  if (typeof window !== "undefined") {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length >= 20) {
          return parsed;
        }
      } catch (e) {
        // Ignore parsing error
      }
    }
  }

  try {
    const res = await fetch(`/api/places/fallback?city=${encodeURIComponent(city)}`);
    if (!res.ok) throw new Error("Failed to fetch fallback places");
    const data = await res.json();
    
    if (typeof window !== "undefined" && data.places && data.places.length > 0) {
      sessionStorage.setItem(cacheKey, JSON.stringify(data.places));
    }
    
    return data.places;
  } catch (err) {
    console.error("Client fallback fetch failed, using local mock data:", err);
    // Hard fallback to mock places on the client if API fails
    const { MOCK_PLACES } = await import("@/data/mock-places");
    return MOCK_PLACES.filter((p) => p.city.toLowerCase() === city.toLowerCase());
  }
};
