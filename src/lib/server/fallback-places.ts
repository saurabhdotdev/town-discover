import { SupportedCityName } from "@/lib/pune-location";
import { Place } from "@/types";
import { fetchLiveTownEvents } from "@/lib/town-events";
import { mergePlaces } from "@/lib/merge-places";
import { MOCK_PLACES } from "@/data/mock-places";
import { getPool } from "@/lib/postgres";

export const getFallbackPlacesForCity = async (city: SupportedCityName): Promise<Place[]> => {
  let dbPlaces: Place[] = [];
  const pool = getPool();
  
  if (pool) {
    try {
      const { rows } = await pool.query(
        `
        SELECT
          id,
          title,
          description,
          category,
          image,
          rating,
          latitude,
          longitude,
          tags,
          city,
          locality,
          price_range AS "priceRange",
          phone,
          website,
          hours,
          review_mood AS "reviewMood"
        FROM approved_places
        WHERE city = $1
        LIMIT 100
        `,
        [city]
      );
      dbPlaces = rows.map((row: any) => ({
        ...row,
        isOpen: true,
        isTrending: false,
        reviewCount: 0,
        distance: 0,
        hours: row.hours ? (typeof row.hours === "string" ? JSON.parse(row.hours) : row.hours) : undefined,
        reviewMood: row.reviewMood ? (typeof row.reviewMood === "string" ? JSON.parse(row.reviewMood) : row.reviewMood) : undefined
      }));
    } catch (dbErr) {
      console.warn("Failed to fetch curated db places, falling back to mock data:", dbErr);
    }
  }

  // If DB is empty, use mock places
  const curatedPlaces = dbPlaces.length > 0 
    ? dbPlaces 
    : MOCK_PLACES.filter((place) => place.city.toLowerCase() === city.toLowerCase());

  try {
    const townEvents = await fetchLiveTownEvents(city);
    return mergePlaces(curatedPlaces, townEvents);
  } catch (e) {
    return curatedPlaces;
  }
};
