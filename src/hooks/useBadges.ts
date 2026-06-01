"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface GamificationStats {
  level: number;
  totalXp: number;
  xpForLevel: number;
  xpForNext: number;
  progress: number;
  title: string;
  badges: { badge_id: string; awarded_at: string }[];
}

export const useBadges = (enabled: boolean) => {
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [newBadgeId, setNewBadgeId] = useState<string | null>(null);
  const prevBadgeIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/gamification");
      if (!res.ok) return;
      const data = await res.json();
      const incoming: GamificationStats = data.stats;

      // Detect newly granted badges
      const incomingIds = new Set(incoming.badges.map((b) => b.badge_id));
      for (const id of incomingIds) {
        if (!prevBadgeIds.current.has(id)) {
          setNewBadgeId(id);
          break; // show one at a time
        }
      }
      prevBadgeIds.current = incomingIds;
      setStats(incoming);
    } catch {
      // silently fail
    }
  }, [enabled]);

  useEffect(() => {
    refresh();

    const handleRefresh = () => {
      refresh();
    };
    window.addEventListener("sheher:refresh-badges", handleRefresh);
    return () => {
      window.removeEventListener("sheher:refresh-badges", handleRefresh);
    };
  }, [refresh]);

  const dismissBadge = useCallback(() => setNewBadgeId(null), []);

  return { stats, newBadgeId, dismissBadge, refresh };
};
