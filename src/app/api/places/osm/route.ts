import { NextRequest } from "next/server";
import { getFallbackPlacesForCity } from "@/data/mock-places";
import { fetchLivePlaces } from "@/lib/live-places";
import { CITY_CENTERS, getCityFromQuery, getNearestSupportedCity } from "@/lib/pune-location";
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
  const latitude = toNumber(request.nextUrl.searchParams.get("lat"));
  const longitude = toNumber(request.nextUrl.searchParams.get("lng"));
  const queryCity = getCityFromQuery(query);
  const location: UserLocation =
    queryCity
      ? CITY_CENTERS[queryCity]
      : latitude !== null && longitude !== null
        ? { latitude, longitude, accuracy: 50 }
        : CITY_CENTERS.Pune;
  const city = queryCity ?? getNearestSupportedCity(location);

  try {
    const places = await withTimeout(fetchLivePlaces(location, request.signal, 4500), 7000);
    return Response.json({ places, city, source: "osm" });
  } catch (error) {
    return Response.json({
      places: getFallbackPlacesForCity(city),
      city,
      source: "fallback",
      warning: error instanceof Error ? error.message : "OpenStreetMap places could not be loaded.",
    });
  }
}
