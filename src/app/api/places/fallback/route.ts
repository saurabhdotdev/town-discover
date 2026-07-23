import { NextRequest } from "next/server";
import { getFallbackPlacesForCity } from "@/lib/server/fallback-places";
import { SupportedCityName } from "@/lib/pune-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cityParam = request.nextUrl.searchParams.get("city") as SupportedCityName;
  if (!cityParam) {
    return Response.json({ error: "City parameter is required" }, { status: 400 });
  }

  try {
    const places = await getFallbackPlacesForCity(cityParam);
    return Response.json({ places }, { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch fallback places";
    return Response.json({ error: msg }, { status: 500 });
  }
}
