import { Pool, PoolClient } from "pg";

// ─── Badge Definitions ────────────────────────────────────────────────────────

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: "saves" | "reports" | "suggestions" | "reviews" | "special";
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-save",
    name: "Wishlist Starter",
    description: "Save your first place to unlock your journey.",
    emoji: "🌱",
    category: "saves",
  },
  {
    id: "collector",
    name: "Collector",
    description: "Save 5 different spots across any city.",
    emoji: "📌",
    category: "saves",
  },
  {
    id: "curator",
    name: "Curator",
    description: "Save 20 places. You have impeccable taste.",
    emoji: "🎨",
    category: "saves",
  },
  {
    id: "night-rider",
    name: "Night Rider",
    description: "Save a night-drive route. Midnight is your lane.",
    emoji: "🌙",
    category: "special",
  },
  {
    id: "street-food-guru",
    name: "Street Food Guru",
    description: "Save 3 street-food spots. Taste the city on the sidewalk.",
    emoji: "🍢",
    category: "saves",
  },
  {
    id: "city-eye",
    name: "City Eye",
    description: "Submit your first crowd report. Help the community.",
    emoji: "👁",
    category: "reports",
  },
  {
    id: "signal-sender",
    name: "Signal Sender",
    description: "Submit 5 crowd reports. You're on the pulse.",
    emoji: "📡",
    category: "reports",
  },
  {
    id: "community-scout",
    name: "Community Scout",
    description: "Suggest your first place. Help put it on the map.",
    emoji: "🗺",
    category: "suggestions",
  },
  {
    id: "spot-approved",
    name: "Spot Approved",
    description: "One of your suggestions was approved and published!",
    emoji: "✅",
    category: "suggestions",
  },
  {
    id: "first-review",
    name: "Local Critic",
    description: "Write your first place review. Let others know the vibe.",
    emoji: "✍️",
    category: "reviews",
  },
  {
    id: "pro-critic",
    name: "Pro Critic",
    description: "Write 5 place reviews. A true guide for the town.",
    emoji: "📝",
    category: "reviews",
  },
  {
    id: "elite-critic",
    name: "Elite Critic",
    description: "Write 15 place reviews. Your reviews are legendary.",
    emoji: "👑",
    category: "reviews",
  },
];

// ─── XP & Level Math ──────────────────────────────────────────────────────────

/** XP thresholds: Level = floor(sqrt(totalXp / 50)) — smoothly scaling. */
export const computeLevel = (totalXp: number) => {
  const level = Math.max(1, Math.floor(Math.sqrt(totalXp / 50)) + 1);
  const xpForLevel = (level - 1) * (level - 1) * 50;
  const xpForNext = level * level * 50;
  const progress = xpForNext === xpForLevel
    ? 100
    : Math.min(100, Math.round(((totalXp - xpForLevel) / (xpForNext - xpForLevel)) * 100));
  return { level, totalXp, xpForLevel, xpForNext, progress };
};

export const LEVEL_TITLES: Record<number, string> = {
  1: "Wanderer",
  2: "Explorer",
  3: "Seeker",
  4: "Discoverer",
  5: "Trailblazer",
  6: "Urban Legend",
  7: "City Oracle",
  8: "Sheher Master",
};

export const getLevelTitle = (level: number) =>
  LEVEL_TITLES[level] ?? LEVEL_TITLES[8];

// ─── Engine Functions ─────────────────────────────────────────────────────────

export const awardXP = async (
  pool: Pool | PoolClient,
  userId: string,
  eventType: string,
  xp: number
) => {
  try {
    await pool.query(
      `INSERT INTO user_xp_events (user_id, event_type, xp) VALUES ($1, $2, $3)`,
      [userId, eventType, xp]
    );
  } catch (err) {
    console.warn("[Gamification] Failed to award XP:", err);
  }
};

export const checkAndGrantBadges = async (
  pool: Pool | PoolClient,
  userId: string,
  context?: {
    savedPlaceCategory?: string;
    savedPlaceTag?: string;
  }
): Promise<string[]> => {
  // All currently earned badges
  const { rows: existingRows } = await pool.query<{ badge_id: string }>(
    `SELECT badge_id FROM user_badges WHERE user_id = $1`,
    [userId]
  );
  const earned = new Set(existingRows.map((r) => r.badge_id));
  const newBadges: string[] = [];

  const grant = async (badgeId: string) => {
    if (earned.has(badgeId)) return;
    await pool.query(
      `INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, badgeId]
    );
    earned.add(badgeId);
    newBadges.push(badgeId);
  };

  // ── Save milestones ──
  const { rows: saveRows } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM saved_places WHERE user_id = $1`,
    [userId]
  );
  const saveCount = Number(saveRows[0]?.cnt ?? 0);
  if (saveCount >= 1) await grant("first-save");
  if (saveCount >= 5) await grant("collector");
  if (saveCount >= 20) await grant("curator");

  // ── Night rider ──
  if (context?.savedPlaceTag === "night-drive") {
    await grant("night-rider");
  }

  // ── Street food guru — 3 saves of street-food/food-stall ──
  const { rows: sfRows } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(sp.place_id) AS cnt
     FROM saved_places sp
     WHERE sp.user_id = $1`,
    [userId]
  );
  // We only track category context on the save action; count street food saves via XP events
  const { rows: sfXpRows } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM user_xp_events
     WHERE user_id = $1 AND event_type IN ('save_street-food', 'save_food-stall')`,
    [userId]
  );
  const sfCount = Number(sfXpRows[0]?.cnt ?? 0);
  if (sfCount >= 3) await grant("street-food-guru");

  // ── Crowd report milestones ──
  const { rows: crRows } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM user_xp_events
     WHERE user_id = $1 AND event_type = 'crowd_report'`,
    [userId]
  );
  const crCount = Number(crRows[0]?.cnt ?? 0);
  if (crCount >= 1) await grant("city-eye");
  if (crCount >= 5) await grant("signal-sender");

  // ── Suggestion milestones ──
  const { rows: sugRows } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM user_xp_events
     WHERE user_id = $1 AND event_type = 'suggestion_submitted'`,
    [userId]
  );
  const sugCount = Number(sugRows[0]?.cnt ?? 0);
  if (sugCount >= 1) await grant("community-scout");

  const { rows: approvedRows } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM user_xp_events
     WHERE user_id = $1 AND event_type = 'suggestion_approved'`,
    [userId]
  );
  const approvedCount = Number(approvedRows[0]?.cnt ?? 0);
  if (approvedCount >= 1) await grant("spot-approved");

  // ── Review milestones ──
  const { rows: revRows } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM place_reviews WHERE user_id = $1`,
    [userId]
  );
  const reviewCount = Number(revRows[0]?.cnt ?? 0);
  if (reviewCount >= 1) await grant("first-review");
  if (reviewCount >= 5) await grant("pro-critic");
  if (reviewCount >= 15) await grant("elite-critic");

  return newBadges;
};

export const getUserStats = async (pool: Pool, userId: string) => {
  const { rows: xpRows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(xp), 0) AS total FROM user_xp_events WHERE user_id = $1`,
    [userId]
  );
  const totalXp = Number(xpRows[0]?.total ?? 0);
  const levelInfo = computeLevel(totalXp);

  const { rows: badgeRows } = await pool.query<{ badge_id: string; awarded_at: string }>(
    `SELECT badge_id, awarded_at FROM user_badges WHERE user_id = $1 ORDER BY awarded_at`,
    [userId]
  );

  return {
    ...levelInfo,
    title: getLevelTitle(levelInfo.level),
    badges: badgeRows,
  };
};
