import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { RATE_LIMIT_READ } from "@/lib/server/rate-limit";
import { getPersonalizedRecommendations } from "@/lib/server/recommender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  { auth: "optional", rateLimit: RATE_LIMIT_READ, rateLimitKey: "GET:/api/recommendations/personalized" },
  async (request: NextRequest, { pool, user }) => {
    const params = request.nextUrl.searchParams;
    const limit = Math.min(24, Math.max(1, Number(params.get("limit") ?? "6") || 6));
    
    // If guest, use a dummy UUID to trigger the cold-start fallback recommendation logic
    const userId = user?.id ?? "00000000-0000-0000-0000-000000000000";
    const city = params.get("city") || undefined;

    const recommendations = await getPersonalizedRecommendations(pool, userId, limit, city);

    return Response.json({
      recommendations,
      isPersonalized: !!user,
    });
  }
);
