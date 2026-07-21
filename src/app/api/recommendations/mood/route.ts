import { NextRequest } from "next/server";
import { getFallbackPlacesForCity } from "@/lib/server/fallback-places";
import { getTopMoodRecommendations, inferMoodProfile, MoodAxis, rankPlacesByMood } from "@/lib/mood-recommendations";
import { mergePlaces } from "@/lib/merge-places";
import { fetchLivePlaces } from "@/lib/live-places";
import { CITY_CENTERS, getCityFromQuery, getNearestSupportedCity } from "@/lib/pune-location";
import { UserLocation, Place } from "@/types";
import { createApiHandler } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOOD_VALUES: MoodAxis[] = [
  "chill",
  "adventurous",
  "social",
  "foodie",
  "romantic",
  "cultural",
  "energetic",
  "budget",
];

const toNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseMood = (value: string | null): MoodAxis | null => {
  if (!value) return null;
  return MOOD_VALUES.includes(value as MoodAxis) ? (value as MoodAxis) : null;
};

export const GET = createApiHandler({ auth: "none" }, async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const query = params.get("query") ?? "";
  const explicitMood = parseMood(params.get("mood"));
  const limit = Math.min(24, Math.max(1, Number(params.get("limit") ?? "12") || 12));
  const latitude = toNumber(params.get("lat"));
  const longitude = toNumber(params.get("lng"));
  const queryCity = getCityFromQuery(query);
  const location: UserLocation =
    queryCity
      ? CITY_CENTERS[queryCity]
      : latitude !== null && longitude !== null
        ? { latitude, longitude, accuracy: 50 }
        : CITY_CENTERS.Pune;
  const city = queryCity ?? getNearestSupportedCity(location);

  let places = await getFallbackPlacesForCity(city);
  try {
    const { getCache, setCache } = await import("@/lib/redis");
    const cacheKey = `places:osm:coords:${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}`;
    let live = await getCache<Place[]>(cacheKey);
    if (!live) {
      live = await fetchLivePlaces(location, request.signal, 5000);
      await setCache(cacheKey, live, 3600); // cache for 1 hour
    }
    if (live && live.length > 0) places = mergePlaces(live, places);
  } catch {
    // fallback already loaded
  }

  const moodProfile = inferMoodProfile({ query, explicitMood });
  const ranked = rankPlacesByMood(places, { query, explicitMood }).slice(0, limit);

  return Response.json({
    city,
    moodProfile,
    recommendations: ranked.map(({ place, moodScore, dominantMood }) => ({
      place,
      moodScore: Math.round(moodScore * 1000) / 1000,
      dominantMood,
    })),
  });
});

export const POST = createApiHandler({ auth: "none" }, async (request: NextRequest) => {
  const body = (await request.json().catch(() => ({}))) as {
    places?: unknown;
    query?: string;
    mood?: string;
    limit?: number;
  };

  const places = Array.isArray(body.places) ? body.places : [];
  const explicitMood = parseMood(body.mood ?? null);
  const limit = Math.min(24, Math.max(1, Number(body.limit ?? 12) || 12));
  const query = typeof body.query === "string" ? body.query : "";

  const recommendations = getTopMoodRecommendations(places as never[], {
    query,
    explicitMood,
    limit,
  });

  return Response.json({
    moodProfile: inferMoodProfile({ query, explicitMood }),
    recommendations,
  });
});

