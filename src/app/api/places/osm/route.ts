import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { getFallbackPlacesForCity } from "@/lib/server/fallback-places";
import { fetchLiveTownEvents } from "@/lib/town-events";
import { fetchLivePlaces } from "@/lib/live-places";
import { mergePlaces } from "@/lib/merge-places";
import { CITY_CENTERS, getCityFromQuery, getNearestSupportedCity, SUPPORTED_CITY_NAMES, SupportedCityName } from "@/lib/pune-location";
import { UserLocation } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("OpenStreetMap took too long to respond.")), timeoutMs);
    }),
  ]);
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? "";
  const cityParam = request.nextUrl.searchParams.get("city");
  const latitude = toNumber(request.nextUrl.searchParams.get("lat"));
  const longitude = toNumber(request.nextUrl.searchParams.get("lng"));

  const south = toNumber(request.nextUrl.searchParams.get("south"));
  const west = toNumber(request.nextUrl.searchParams.get("west"));
  const north = toNumber(request.nextUrl.searchParams.get("north"));
  const east = toNumber(request.nextUrl.searchParams.get("east"));

  let resolvedCityParam: SupportedCityName | null = null;
  if (cityParam) {
    const found = SUPPORTED_CITY_NAMES.find(c => c.toLowerCase() === cityParam.toLowerCase());
    if (found) resolvedCityParam = found;
  }

  const hasBounds = south !== null && west !== null && north !== null && east !== null;

  if (hasBounds) {
    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;
    const centerLoc = { latitude: centerLat, longitude: centerLng, accuracy: 50 };
    const city = resolvedCityParam ?? getNearestSupportedCity(centerLoc);
    const townEvents = await fetchLiveTownEvents(city);
    const filteredEvents = townEvents.filter(
      (e) => e.latitude >= south && e.latitude <= north && e.longitude >= west && e.longitude <= east
    );

    let approvedPlaces: any[] = [];
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
          WHERE location && ST_MakeEnvelope($3, $1, $4, $2, 4326)
          `,
          [south, north, west, east]
        );
        approvedPlaces = rows.map((row: any) => ({
          ...row,
          isOpen: true,
          isTrending: false,
          reviewCount: 0,
          distance: 0,
          hours: row.hours ? (typeof row.hours === "string" ? JSON.parse(row.hours) : row.hours) : undefined,
          reviewMood: row.reviewMood ? (typeof row.reviewMood === "string" ? JSON.parse(row.reviewMood) : row.reviewMood) : undefined
        }));
      } catch (dbErr) {
        console.error("Failed to fetch approved places by bounds:", dbErr);
      }
    }

    try {
      const { fetchLivePlacesByBounds } = await import("@/lib/live-places");
      const cacheKey = `places:bounds:${south.toFixed(3)}:${west.toFixed(3)}:${north.toFixed(3)}:${east.toFixed(3)}`;
      
      const { getCache, setCache } = await import("@/lib/redis");
      let livePlaces = await getCache<any[]>(cacheKey);
      if (!livePlaces) {
        livePlaces = await fetchLivePlacesByBounds({ south, west, north, east });
        await setCache(cacheKey, livePlaces, 600);
      }

      const places = mergePlaces([...approvedPlaces, ...livePlaces], filteredEvents);
      return Response.json(
        { places, city, source: "osm-bounds", eventsMerged: filteredEvents.length },
        { status: 200, headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=1200" } }
      );
    } catch (error: any) {
      console.error("OSM bounds fetch failed:", error);
      const places = mergePlaces([...approvedPlaces], filteredEvents);
      return Response.json(
        { places, city, source: "fallback-bounds", eventsMerged: filteredEvents.length, warning: error.message },
        { status: 200 }
      );
    }
  }

  const queryCity = getCityFromQuery(query) ?? resolvedCityParam;
  const location: UserLocation =
    queryCity
      ? CITY_CENTERS[queryCity]
      : latitude !== null && longitude !== null
        ? { latitude, longitude, accuracy: 50 }
        : CITY_CENTERS.Pune;
  const city = queryCity ?? getNearestSupportedCity(location);

  const townEvents = await fetchLiveTownEvents(city);

  let approvedPlaces: any[] = [];
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
        `,
        [city]
      );
      approvedPlaces = rows.map((row: any) => ({
        ...row,
        isOpen: true,
        isTrending: false,
        reviewCount: 0,
        distance: 0,
        hours: row.hours ? (typeof row.hours === "string" ? JSON.parse(row.hours) : row.hours) : undefined,
        reviewMood: row.reviewMood ? (typeof row.reviewMood === "string" ? JSON.parse(row.reviewMood) : row.reviewMood) : undefined
      }));
    } catch (dbErr) {
      console.error("Failed to fetch approved places:", dbErr);
    }
  }

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (googleApiKey) {
    try {
      const { fetchGooglePlaces } = await import("@/lib/google-places");
      const googlePlaces = await fetchGooglePlaces(query, city, location);
      const places = mergePlaces([...approvedPlaces, ...googlePlaces], townEvents);
      return Response.json(
        { places, city, source: "google", eventsMerged: townEvents.length },
        { status: 200, headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=1200" } }
      );
    } catch (error) {
      console.error("Google Places API failed, falling back to OpenStreetMap:", error);
    }
  }

  try {
    const livePlaces = await fetchLivePlaces(location, request.signal);
    const places = mergePlaces([...approvedPlaces, ...livePlaces], townEvents);
    return Response.json({ places, city, source: "osm", eventsMerged: townEvents.length }, { status: 200, headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=1200" } });
  } catch (error) {
    const fallbackPlaces = await getFallbackPlacesForCity(city);
    const places = mergePlaces([...approvedPlaces, ...fallbackPlaces], townEvents);
    return Response.json({
      places,
      city,
      source: "fallback",
      eventsMerged: townEvents.length,
      warning: error instanceof Error ? error.message : "OpenStreetMap places could not be loaded.",
    }, { status: 200, headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=1200" } });
  }
}
