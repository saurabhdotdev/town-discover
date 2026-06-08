import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { RATE_LIMIT_READ } from "@/lib/server/rate-limit";
import { MOCK_PLACES } from "@/data/mock-places";
import { Place } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RankedValue = {
  label: string;
  count: number;
};

const rankValues = (values: string[]): RankedValue[] => {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

const compactPlace = (place: Place, reason: string, privateSignal: string) => ({
  id: place.id,
  title: place.title,
  category: place.category,
  city: place.city,
  locality: place.locality,
  rating: place.rating,
  priceRange: place.priceRange ?? "$$",
  image: place.image,
  reason,
  privateSignal,
});

export const GET = createApiHandler(
  { auth: "required", rateLimit: RATE_LIMIT_READ, rateLimitKey: "GET:/api/private-discovery" },
  async (_request: NextRequest, { pool, user }) => {
    const { rows: savedRows } = await pool.query<{ placeId: string; createdAt: string }>(
      `
      SELECT place_id AS "placeId", created_at AS "createdAt"
      FROM saved_places
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 120
      `,
      [user!.id]
    );

    const { rows: folderRows } = await pool.query<{ id: string; name: string; count: number }>(
      `
      SELECT
        folders.id,
        folders.name,
        COUNT(items.place_id)::int AS count
      FROM saved_place_folders folders
      LEFT JOIN saved_place_folder_items items ON items.folder_id = folders.id
      WHERE folders.user_id = $1
      GROUP BY folders.id, folders.name, folders.created_at
      ORDER BY folders.created_at DESC
      LIMIT 20
      `,
      [user!.id]
    );

    const savedIds = new Set(savedRows.map((row) => row.placeId));
    const savedPlaces = MOCK_PLACES.filter((place) => savedIds.has(place.id));
    const topCities = rankValues(savedPlaces.map((place) => place.city));
    const topCategories = rankValues(savedPlaces.map((place) => place.category));
    const topLocalities = rankValues(savedPlaces.map((place) => place.locality));
    const primaryCity = topCities[0]?.label ?? "Pune";
    const primaryCategory = topCategories[0]?.label;
    const isPremium = Boolean(user!.isPremiumPass);

    const candidatePool = MOCK_PLACES.filter((place) => !savedIds.has(place.id));
    const scored = candidatePool
      .map((place) => {
        const cityBoost = place.city === primaryCity ? 4 : topCities.some((city) => city.label === place.city) ? 2 : 0;
        const categoryBoost = primaryCategory && place.category === primaryCategory ? 3 : 0;
        const localityBoost = topLocalities.some((locality) => locality.label === place.locality) ? 2 : 0;
        const trendBoost = place.isTrending ? 1.5 : 0;
        return {
          place,
          score: place.rating + cityBoost + categoryBoost + localityBoost + trendBoost,
        };
      })
      .sort((a, b) => b.score - a.score || b.place.reviewCount - a.place.reviewCount);

    const quickPicks = scored.slice(0, isPremium ? 6 : 3).map(({ place }, index) =>
      compactPlace(
        place,
        index === 0
          ? `Best match for your ${primaryCity} saves.`
          : primaryCategory
            ? `Matches your ${primaryCategory.replace("-", " ")} pattern.`
            : "A strong next save based on your profile.",
        isPremium
          ? `Private signal: ${place.rating.toFixed(1)} rating, ${place.reviewCount}+ reviews, and similar saved behavior.`
          : "Upgrade signal hidden in Explorer Pass."
      )
    );

    const premiumUnlocks = scored.slice(6, 10).map(({ place }) =>
      compactPlace(
        place,
        "Reserved for your next private shortlist.",
        `Why it fits: ${place.locality}, ${place.city} + ${place.category.replace("-", " ")} affinity.`
      )
    );

    const nextMoves = [
      savedPlaces.length >= 3
        ? `Build a ${primaryCity} mini-plan from your saved spots.`
        : "Save at least 3 places to make private matching sharper.",
      folderRows.length > 0
        ? `Use "${folderRows[0].name}" as your next collection to refine recommendations.`
        : "Create one collection like Date Night, Solo Work, or Weekend Food.",
      isPremium
        ? "Explorer Pass is active: show private deal-ready picks and stronger weekend routing."
        : "Explorer Pass unlocks the hidden reasons, larger shortlist, and deal-ready picks.",
    ];

    return Response.json({
      summary: {
        savedCount: savedRows.length,
        collectionCount: folderRows.length,
        primaryCity,
        primaryCategory: primaryCategory ?? null,
        isPremium,
        privacy: "Computed from your saved places and collections. Not visible to other users.",
      },
      insights: [
        topCities[0] ? `Your strongest city signal is ${topCities[0].label}.` : "No strong city signal yet.",
        topCategories[0] ? `You lean toward ${topCategories[0].label.replace("-", " ")} spots.` : "Save more places to reveal a category pattern.",
        topLocalities[0] ? `${topLocalities[0].label} is emerging as a repeat area.` : "No repeat locality yet.",
      ],
      quickPicks,
      premiumUnlocks: isPremium ? premiumUnlocks : premiumUnlocks.slice(0, 2).map((place) => ({
        ...place,
        title: "Private pick locked",
        image: "",
      })),
      nextMoves,
    });
  }
);
