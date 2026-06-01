import { NextRequest } from "next/server";
import { MOCK_PLACES } from "@/data/mock-places";
import { fetchOSMPlacesByIds } from "@/lib/live-places";
import { Place } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (ids.length === 0) {
    return Response.json({ places: [] });
  }

  try {
    const mockIds = ids.filter((id) => !id.startsWith("osm-"));
    const osmIds = ids.filter((id) => id.startsWith("osm-"));

    const resolvedMockPlaces = MOCK_PLACES.filter((p) => mockIds.includes(p.id));
    
    let resolvedOSMPlaces: Place[] = [];
    if (osmIds.length > 0) {
      resolvedOSMPlaces = await fetchOSMPlacesByIds(osmIds);
    }

    const places = [...resolvedMockPlaces, ...resolvedOSMPlaces];
    return Response.json({ places });
  } catch (error: any) {
    console.error("Error resolving places:", error);
    return Response.json({ error: "Failed to resolve places.", details: error.message }, { status: 500 });
  }
}
