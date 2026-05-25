import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { CrowdLevel } from "@/types";
import { ensureAuthSetup, requireCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const crowdLevels = new Set<CrowdLevel>(["low", "moderate", "busy", "very_crowded"]);
const activeWindowSql = "NOW() - INTERVAL '45 minutes'";
const cooldownWindowSql = "NOW() - INTERVAL '10 minutes'";
const cooldownMinutes = 10;

const setupSql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS crowd_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL,
  crowd_level TEXT NOT NULL CHECK (
    crowd_level IN ('low', 'moderate', 'busy', 'very_crowded')
  ),
  note TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crowd_reports_place_id_reported_at_idx
ON crowd_reports (place_id, reported_at DESC);
`;

let setupPromise: Promise<void> | null = null;

const ensureSetup = async () => {
  const pool = getPool();
  if (!pool) {
    throw new Error("DATABASE_URL is not configured.");
  }

  setupPromise ??= pool.query(setupSql).then(() => undefined);
  await setupPromise;
  return pool;
};

const pruneExpiredReports = async (pool: Awaited<ReturnType<typeof ensureSetup>>) => {
  await pool.query(`DELETE FROM crowd_reports WHERE reported_at < ${activeWindowSql}`);
};

const ensureCrowdUserColumn = async (pool: Awaited<ReturnType<typeof ensureSetup>>) => {
  await ensureAuthSetup(pool);
  await pool.query("ALTER TABLE crowd_reports ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL");
  await pool.query(`
    CREATE INDEX IF NOT EXISTS crowd_reports_place_user_reported_at_idx
    ON crowd_reports (place_id, user_id, reported_at DESC)
  `);
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

const getPlaceSummary = async (pool: Awaited<ReturnType<typeof ensureSetup>>, placeId: string) => {
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

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("placeId")?.trim();
  const placeIds = request.nextUrl.searchParams
    .get("placeIds")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 80);

  try {
    const pool = await ensureSetup();
    await pruneExpiredReports(pool);

    if (placeIds?.length) {
      const { rows } = await pool.query(summariesSql("AND place_id = ANY($1::text[])"), [placeIds]);
      const summariesById = Object.fromEntries(rows.map((row) => [row.placeId, row]));

      return Response.json({ summaries: summariesById });
    }

    if (!placeId) {
      const { rows } = await pool.query(
        summariesSql("")
      );

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
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load crowd report." },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const pool = await ensureSetup();
    await ensureCrowdUserColumn(pool);
    const auth = await requireCurrentUser(pool, request);
    if (!auth.user) return auth.response;

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
      [placeId, auth.user.id]
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

    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM crowd_reports WHERE place_id = $1 AND user_id = $2", [placeId, auth.user.id]);
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
        [placeId, crowdLevel, note, auth.user.id]
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
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save crowd report." },
      { status: 503 }
    );
  }
}
