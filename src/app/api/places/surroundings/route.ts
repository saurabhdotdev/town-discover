import { NextRequest } from "next/server";
import { calculateDistance } from "@/lib/geo";
import { getCache, setCache } from "@/lib/redis";
import { createApiHandler } from "@/lib/server/api-handler";
import { BadRequestError } from "@/lib/server/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const overpassEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

async function fetchOverpassWithTimeout(
  query: string,
  timeoutMs = 15000
): Promise<Response> {
  const controllers = overpassEndpoints.map(() => new AbortController());

  // Set a global timeout to abort all requests if no mirror responds within timeoutMs
  const globalTimeoutId = setTimeout(() => {
    controllers.forEach((c) => c.abort());
  }, timeoutMs);

  try {
    const promises = overpassEndpoints.map(async (endpoint, index) => {
      const controller = controllers[index];
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "Sheher/1.0 contact:town-discover.vercel.app",
          },
          signal: controller.signal,
        });

        if (response.ok) {
          // Abort all other requests since we found a successful one
          controllers.forEach((c, idx) => {
            if (idx !== index) {
              c.abort();
            }
          });
          return response;
        }
        throw new Error(`HTTP ${response.status} from ${endpoint}`);
      } catch (err: any) {
        if (err.name === "AbortError") {
          throw new Error(`Request to ${endpoint} was aborted`);
        }
        throw err;
      }
    });

    // Promise.any resolves as soon as any of the promises resolves successfully.
    // If all promises reject, it throws an AggregateError.
    return await Promise.any(promises);
  } catch (err: any) {
    if (err instanceof AggregateError) {
      const errorsList = err.errors.map((e) => e.message || e).join("; ");
      throw new Error(`All Overpass endpoints failed: ${errorsList}`);
    }
    throw err;
  } finally {
    clearTimeout(globalTimeoutId);
  }
}

export const GET = createApiHandler({ auth: "none" }, async (request: NextRequest) => {
  const latStr = request.nextUrl.searchParams.get("lat");
  const lngStr = request.nextUrl.searchParams.get("lng");
  const radiusStr = request.nextUrl.searchParams.get("radius") ?? "350";

  if (!latStr || !lngStr) {
    throw new BadRequestError("lat and lng parameters are required");
  }

  const lat = Number(latStr);
  const lng = Number(lngStr);
  const radius = Number(radiusStr);

  if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
    throw new BadRequestError("Invalid lat, lng, or radius values");
  }

  if (lat < -90 || lat > 90) {
    throw new BadRequestError("Latitude must be between -90 and 90 degrees");
  }

  if (lng < -180 || lng > 180) {
    throw new BadRequestError("Longitude must be between -180 and 180 degrees");
  }

  if (radius < 1 || radius > 2000) {
    throw new BadRequestError("Radius must be between 1 and 2000 meters");
  }

  // toFixed(3) ≈ 110m — same place always hits the same cache key (was toFixed(4) = 11m)
  const cacheKey = `surroundings:lat:${lat.toFixed(3)}:lng:${lng.toFixed(3)}:rad:${radius}`;

  try {
    const cachedData = await getCache<any[]>(cacheKey);
    if (cachedData) {
      return Response.json(
        { surroundings: cachedData },
        { status: 200, headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=1800" } }
      );
    }
  } catch (err) {
    console.error("Cache read failed:", err);
  }

  const query = `
    [out:json][timeout:15];
    (
      node(around:${radius},${lat},${lng})["amenity"~"^(toilets|parking|atm|drinking_water|police|hospital|pharmacy|post_box)$"];
      way(around:${radius},${lat},${lng})["amenity"~"^(toilets|parking|atm|drinking_water|police|hospital|pharmacy|post_box)$"];
      node(around:${radius},${lat},${lng})["highway"~"^(bus_stop)$"];
      node(around:${radius},${lat},${lng})["tourism"~"^(information)$"];
    );
    out center tags 30;
  `;

  const response = await fetchOverpassWithTimeout(query, 15000);
  const data = await response.json();

  const elements = data.elements ?? [];
  const seen = new Set<string>();
  
  const surroundings = elements
    .map((el: any) => {
      const itemLat = el.lat ?? el.center?.lat;
      const itemLng = el.lon ?? el.center?.lon;
      const tags = el.tags ?? {};
      const name = tags.name || null;

      if (!itemLat || !itemLng) return null;

      const distance = calculateDistance(lat, lng, itemLat, itemLng);
      
      let type = "other";
      let label = "Amenity";
      if (tags.amenity === "toilets") {
        type = "toilets";
        label = "Public Toilets";
      } else if (tags.amenity === "parking") {
        type = "parking";
        label = "Parking Lot";
      } else if (tags.amenity === "atm") {
        type = "atm";
        label = "ATM";
      } else if (tags.amenity === "drinking_water") {
        type = "water";
        label = "Drinking Water";
      } else if (tags.highway === "bus_stop") {
        type = "transit";
        label = "Bus Stop";
      } else if (tags.tourism === "information") {
        type = "info";
        label = "Information Desk";
      } else if (tags.amenity === "police") {
        type = "police";
        label = "Police Station";
      } else if (tags.amenity === "hospital") {
        type = "hospital";
        label = "Hospital";
      } else if (tags.amenity === "pharmacy") {
        type = "pharmacy";
        label = "Pharmacy";
      }

      const key = `${type}-${name}-${itemLat.toFixed(4)}-${itemLng.toFixed(4)}`;
      if (seen.has(key)) return null;
      seen.add(key);

      return {
        id: `${el.type}-${el.id}`,
        name,
        type,
        label,
        distance, // in km
        latitude: itemLat,
        longitude: itemLng,
        details: {
          fee: tags.fee ?? null,
          access: tags.access ?? null,
          wheelchair: tags.wheelchair ?? null,
          capacity: tags.capacity ?? null,
          operator: tags.operator ?? null,
          network: tags.network ?? null,
          openingHours: tags.opening_hours ?? null,
        }
      };
    })
    .filter((item: any) => item !== null)
    .sort((a: any, b: any) => a.distance - b.distance);

  try {
    await setCache(cacheKey, surroundings, 1800); // 30 minutes
  } catch (err) {
    console.error("Cache write failed:", err);
  }

  return Response.json({ surroundings }, { status: 200, headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=1800" } });
});
