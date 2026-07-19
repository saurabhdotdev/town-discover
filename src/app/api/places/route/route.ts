import { NextRequest } from "next/server";
import { getCache, setCache } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const coords = request.nextUrl.searchParams.get("coords");
  const mode = request.nextUrl.searchParams.get("mode") || "foot";

  if (!coords) {
    return Response.json({ error: "Missing required parameter 'coords'." }, { status: 400 });
  }

  const cacheKey = `route:${mode}:${coords}`;
  try {
    const cachedRoute = await getCache<Record<string, unknown>>(cacheKey);
    if (cachedRoute) {
      return Response.json({ ...cachedRoute, source: "cache" });
    }
  } catch (cacheErr) {
    console.error("Redis cache read error:", cacheErr);
  }

  const primaryUrl = mode === "driving"
    ? `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    : `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`;

  const secondaryUrl = mode === "driving"
    ? `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson`
    : `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson`;

  const fetchWithTimeout = async (url: string) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) {
      throw new Error("Invalid route response code from OSRM");
    }
    return data;
  };

  try {
    const data = await fetchWithTimeout(primaryUrl);
    try {
      await setCache(cacheKey, data, 86400);
    } catch (cacheErr) {
      console.error("Redis cache write error:", cacheErr);
    }
    return Response.json({ ...data, source: "primary" });
  } catch (primaryErr) {
    console.warn(`Primary routing endpoint failed: ${primaryUrl}. Error:`, primaryErr);

    try {
      const data = await fetchWithTimeout(secondaryUrl);
      try {
        await setCache(cacheKey, data, 86400);
      } catch (cacheErr) {
        console.error("Redis cache write error:", cacheErr);
      }
      return Response.json({ ...data, source: "secondary" });
    } catch (secondaryErr) {
      console.error("Secondary routing endpoint failed as well. Error:", secondaryErr);
      return Response.json(
        { error: "All OSRM routing endpoints failed to respond." },
        { status: 502 }
      );
    }
  }
}
