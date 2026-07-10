import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/visit-time?placeId=<id>
 *
 * Returns hourly crowd signals for a place, blending:
 *   - Real crowd-report history from `place_visit_signals` (if ≥3 samples in a bucket)
 *   - Otherwise falls back to the Gaussian model (score = null, client uses its own curve)
 *
 * Response shape:
 * {
 *   placeId: string,
 *   signals: Array<{
 *     hourOfDay: number,   // 0-23
 *     avgScore: number,    // 1.0–4.0 (low=1, moderate=2, busy=3, very_crowded=4)
 *     sampleCount: number, // number of reports that built this bucket
 *   }>
 * }
 */
export const GET = createApiHandler({ auth: "none" }, async (request: NextRequest, { pool }) => {
  const placeId = request.nextUrl.searchParams.get("placeId")?.trim();

  if (!placeId) {
    return Response.json({ error: "placeId is required." }, { status: 400 });
  }

  const { rows } = await pool.query<{
    hourOfDay: number;
    avgScore: number;
    sampleCount: number;
  }>(
    `
    SELECT
      hour_of_day  AS "hourOfDay",
      avg_score    AS "avgScore",
      sample_count AS "sampleCount"
    FROM place_visit_signals
    WHERE place_id = $1
      AND sample_count >= 3
    ORDER BY hour_of_day ASC
    `,
    [placeId]
  );

  return Response.json({
    placeId,
    signals: rows,
  });
});
