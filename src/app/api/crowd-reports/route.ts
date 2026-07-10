import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { CrowdLevel } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const crowdLevels = new Set<CrowdLevel>(["low", "moderate", "busy", "very_crowded"]);
const activeWindowSql = "NOW() - INTERVAL '45 minutes'";
const cooldownWindowSql = "NOW() - INTERVAL '10 minutes'";
const cooldownMinutes = 10;

const pruneExpiredReports = async (pool: any) => {
  await pool.query(`DELETE FROM crowd_reports WHERE reported_at < ${activeWindowSql}`);
};

const summariesSql = (whereClause: string) => `
WITH ranked_reports AS (
  SELECT
    place_id,
    reported_at,
    ROW_NUMBER() OVER (
      PARTITION BY place_id, COALESCE(user_id::text, id::text)
      ORDER BY reported_at DESC
    ) AS report_rank,
    CASE crowd_level
      WHEN 'low' THEN 1
      WHEN 'moderate' THEN 2
      WHEN 'busy' THEN 3
      WHEN 'very_crowded' THEN 4
    END AS crowd_score
  FROM crowd_reports
  WHERE reported_at >= ${activeWindowSql}
  ${whereClause}
),
active_reports AS (
  SELECT place_id, reported_at, crowd_score
  FROM ranked_reports
  WHERE report_rank = 1
),
summary AS (
  SELECT
    place_id,
    COUNT(*)::int AS report_count,
    AVG(crowd_score)::float AS average_score,
    MAX(reported_at) AS latest_reported_at
  FROM active_reports
  GROUP BY place_id
)
SELECT
  place_id AS "placeId",
  CASE
    WHEN average_score IS NULL THEN NULL
    WHEN average_score < 1.5 THEN 'low'
    WHEN average_score < 2.5 THEN 'moderate'
    WHEN average_score < 3.5 THEN 'busy'
    ELSE 'very_crowded'
  END AS "crowdLevel",
  report_count AS "reportCount",
  ROUND(average_score::numeric, 2)::float AS "averageScore",
  latest_reported_at AS "latestReportedAt"
FROM summary
ORDER BY latest_reported_at DESC
`;

const getPlaceSummary = async (pool: any, placeId: string) => {
  const { rows } = await pool.query(summariesSql("AND place_id = $1"), [placeId]);

  return (
    rows[0] ?? {
      placeId,
      crowdLevel: null,
      reportCount: 0,
      averageScore: null,
      latestReportedAt: null,
    }
  );
};

export const GET = createApiHandler({ auth: "none" }, async (request: NextRequest, { pool }) => {
  const placeId = request.nextUrl.searchParams.get("placeId")?.trim();
  const placeIds = request.nextUrl.searchParams
    .get("placeIds")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 80);

  await pruneExpiredReports(pool);

  if (placeIds?.length) {
    const { rows } = await pool.query(summariesSql("AND place_id = ANY($1::text[])"), [placeIds]);
    const summariesById = Object.fromEntries(rows.map((row) => [row.placeId, row]));

    return Response.json({ summaries: summariesById });
  }

  if (!placeId) {
    const { rows } = await pool.query(summariesSql(""));
    return Response.json({ summaries: rows });
  }

  const reportsResult = await pool.query(
    `
    WITH ranked_reports AS (
      SELECT
        id,
        place_id,
        crowd_level,
        note,
        reported_at,
        ROW_NUMBER() OVER (
          PARTITION BY place_id, COALESCE(user_id::text, id::text)
          ORDER BY reported_at DESC
        ) AS report_rank
      FROM crowd_reports
      WHERE place_id = $1
        AND reported_at >= ${activeWindowSql}
    )
    SELECT
      id,
      place_id AS "placeId",
      crowd_level AS "crowdLevel",
      note,
      reported_at AS "reportedAt"
    FROM ranked_reports
    WHERE report_rank = 1
    ORDER BY reported_at DESC
    LIMIT 12
    `,
    [placeId]
  );
  const summary = await getPlaceSummary(pool, placeId);

  return Response.json({ summary, reports: reportsResult.rows, report: reportsResult.rows[0] ?? null });
});

export const POST = createApiHandler({ auth: "required" }, async (request: NextRequest, { pool, user }) => {
  const body = await request.json();
  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  const crowdLevel = body.crowdLevel as CrowdLevel;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 180) : "";

  if (!placeId) {
    return Response.json({ error: "placeId is required." }, { status: 400 });
  }

  if (!crowdLevels.has(crowdLevel)) {
    return Response.json({ error: "crowdLevel is invalid." }, { status: 400 });
  }

  await pruneExpiredReports(pool);
  const recentReportResult = await pool.query(
    `
    SELECT
      id,
      EXTRACT(EPOCH FROM (reported_at + INTERVAL '10 minutes' - NOW()))::int AS retry_after_seconds
    FROM crowd_reports
    WHERE place_id = $1
      AND user_id = $2
      AND reported_at > ${cooldownWindowSql}
    ORDER BY reported_at DESC
    LIMIT 1
    `,
    [placeId, user!.id]
  );

  if (recentReportResult.rows[0]) {
    const retryAfterSeconds = Math.max(1, recentReportResult.rows[0].retry_after_seconds ?? cooldownMinutes * 60);
    const summary = await getPlaceSummary(pool, placeId);

    return Response.json(
      {
        error: `You already reported this place. You can update your crowd report in ${Math.ceil(retryAfterSeconds / 60)} min.`,
        retryAfterSeconds,
        summary,
      },
      { status: 429 }
    );
  }

  const client = await pool.connect();
  let report;

  // Map crowd level to a 1-4 score for the visit signals table
  const crowdScoreMap: Record<CrowdLevel, number> = {
    low: 1,
    moderate: 2,
    busy: 3,
    very_crowded: 4,
  };
  const crowdScore = crowdScoreMap[crowdLevel];
  const reportHour = new Date().getHours();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM crowd_reports WHERE place_id = $1 AND user_id = $2", [placeId, user!.id]);
    const { rows } = await client.query(
      `
      INSERT INTO crowd_reports (place_id, crowd_level, note, user_id)
      VALUES ($1, $2, NULLIF($3, ''), $4)
      RETURNING
        id,
        place_id AS "placeId",
        crowd_level AS "crowdLevel",
        note,
        reported_at AS "reportedAt"
      `,
      [placeId, crowdLevel, note, user!.id]
    );

    // ── Persist signal into place_visit_signals (running average) ──────────
    // Uses UPSERT with a weighted average: avg = (avg * n + new) / (n + 1)
    // Capped at 500 samples so recent signals stay influential.
    await client.query(
      `
      INSERT INTO place_visit_signals (place_id, hour_of_day, sample_count, avg_score, last_updated)
      VALUES ($1, $2, 1, $3, NOW())
      ON CONFLICT (place_id, hour_of_day) DO UPDATE SET
        avg_score    = ROUND(
          (place_visit_signals.avg_score * LEAST(place_visit_signals.sample_count, 500) + EXCLUDED.avg_score)
          / (LEAST(place_visit_signals.sample_count, 500) + 1)::numeric,
          3
        ),
        sample_count = LEAST(place_visit_signals.sample_count + 1, 501),
        last_updated = NOW()
      `,
      [placeId, reportHour, crowdScore]
    );

    await client.query("COMMIT");
    report = rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }


  const summary = await getPlaceSummary(pool, placeId);

  return Response.json({ report, summary }, { status: 201 });
});
