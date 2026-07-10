import { computeLevel, getLevelTitle, BADGE_DEFINITIONS } from "@/lib/gamification";
import { getCache, setCache } from "@/lib/redis";
import { createApiHandler } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler({ auth: "none" }, async (request, { pool }) => {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || null;
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);

  const cacheKey = `leaderboard:${city ?? "all"}:${limit}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return Response.json(cached, {
      headers: { "X-Cache": "HIT", "Cache-Control": "public, s-maxage=60" },
    });
  }

  // Aggregate total XP per user
  const { rows } = await pool.query<{
    user_id: string;
    full_name: string;
    total_xp: string;
    badge_count: string;
  }>(
    `SELECT
      u.id AS user_id,
      u.full_name,
      COALESCE(SUM(x.xp), 0) AS total_xp,
      COUNT(DISTINCT b.badge_id) AS badge_count
     FROM users u
     LEFT JOIN user_xp_events x ON x.user_id = u.id
     LEFT JOIN user_badges b ON b.user_id = u.id
     GROUP BY u.id, u.full_name
     HAVING COALESCE(SUM(x.xp), 0) > 0
     ORDER BY total_xp DESC
     LIMIT $1`,
    [limit]
  );

  // Fetch badges per user (top badge ids)
  const userIds = rows.map((r) => r.user_id);
  const badgesByUser: Record<string, string[]> = {};

  if (userIds.length > 0) {
    const { rows: badgeRows } = await pool.query<{ user_id: string; badge_id: string }>(
      `SELECT user_id, badge_id FROM user_badges WHERE user_id = ANY($1) ORDER BY awarded_at ASC`,
      [userIds]
    );
    for (const row of badgeRows) {
      if (!badgesByUser[row.user_id]) badgesByUser[row.user_id] = [];
      badgesByUser[row.user_id].push(row.badge_id);
    }
  }

  const leaderboard = rows.map((row, index) => {
    const totalXp = Number(row.total_xp);
    const levelInfo = computeLevel(totalXp);
    const badges = (badgesByUser[row.user_id] || []).slice(0, 3);
    const badgeDefs = badges
      .map((id) => BADGE_DEFINITIONS.find((b) => b.id === id))
      .filter(Boolean);

    return {
      rank: index + 1,
      userId: row.user_id,
      fullName: row.full_name || "Anonymous Explorer",
      totalXp,
      level: levelInfo.level,
      levelTitle: getLevelTitle(levelInfo.level),
      progress: levelInfo.progress,
      badgeCount: Number(row.badge_count),
      topBadges: badgeDefs,
    };
  });

  const result = { leaderboard, total: leaderboard.length };
  await setCache(cacheKey, result, 60); // 60 second cache

  return Response.json(result, {
    headers: { "X-Cache": "MISS", "Cache-Control": "public, s-maxage=60" },
  });
});

