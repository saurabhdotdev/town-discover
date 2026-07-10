import { NextRequest } from "next/server";
import { MOCK_PLACES } from "@/data/mock-places";
import { fetchOSMPlacesByIds } from "@/lib/live-places";
import { getPool } from "@/lib/postgres";
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
    const pool = getPool();
    let resolvedDbPlaces: Place[] = [];

    if (pool) {
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
        WHERE id = ANY($1)
        `,
        [ids]
      );

      resolvedDbPlaces = rows.map((row: any) => ({
        ...row,
        isOpen: true,
        isTrending: false,
        reviewCount: 0,
        distance: 0,
        hours: row.hours ? (typeof row.hours === "string" ? JSON.parse(row.hours) : row.hours) : undefined,
        reviewMood: row.reviewMood ? (typeof row.reviewMood === "string" ? JSON.parse(row.reviewMood) : row.reviewMood) : undefined
      }));
    }

    const resolvedDbIds = new Set(resolvedDbPlaces.map((p) => p.id));
    const missingIds = ids.filter((id) => !resolvedDbIds.has(id));

    let resolvedOSMPlaces: Place[] = [];
    const osmMissingIds = missingIds.filter((id) => id.startsWith("osm-"));
    if (osmMissingIds.length > 0) {
      resolvedOSMPlaces = await fetchOSMPlacesByIds(osmMissingIds);
    }

    const mockMissingIds = missingIds.filter((id) => !id.startsWith("osm-"));
    const resolvedMockPlaces = MOCK_PLACES.filter((p) => mockMissingIds.includes(p.id));

    const places = [...resolvedDbPlaces, ...resolvedOSMPlaces, ...resolvedMockPlaces];
    return Response.json({ places });
  } catch (error: any) {
    console.error("Error resolving places:", error);
    return Response.json({ error: "Failed to resolve places.", details: error.message }, { status: 500 });
  }
}

