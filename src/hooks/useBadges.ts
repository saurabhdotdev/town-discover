"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";

export interface GamificationStats {
  level: number;
  totalXp: number;
  xpForLevel: number;
  xpForNext: number;
  progress: number;
  title: string;
  badges: { badge_id: string; awarded_at: string }[];
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to fetch gamification stats");
  return res.json();
});

export const useBadges = (enabled: boolean) => {
  const { data, mutate } = useSWR<{ stats: GamificationStats }>(
    enabled ? "/api/gamification" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 4000,
    }
  );

  const [newBadgeId, setNewBadgeId] = useState<string | null>(null);
  const prevBadgeIds = useRef<Set<string>>(new Set());

  const stats = data?.stats ?? null;

  // Detect newly granted badges when stats change
  useEffect(() => {
    if (!stats) return;

    const incomingIds = new Set(stats.badges.map((b) => b.badge_id));

    // On the first load, initialize the prevBadgeIds without triggering a popup
    if (prevBadgeIds.current.size === 0 && stats.badges.length > 0) {
      prevBadgeIds.current = incomingIds;
      return;
    }

    for (const id of incomingIds) {
      if (!prevBadgeIds.current.has(id)) {
        setNewBadgeId(id);
        break; // show one at a time
      }
    }
    prevBadgeIds.current = incomingIds;
  }, [stats]);

  // Handle global refresh events
  useEffect(() => {
    const handleRefresh = () => {
      mutate();
    };
    window.addEventListener("sheher:refresh-badges", handleRefresh);
    return () => {
      window.removeEventListener("sheher:refresh-badges", handleRefresh);
    };
  }, [mutate]);

  const dismissBadge = useCallback(() => setNewBadgeId(null), []);

  return { stats, newBadgeId, dismissBadge, refresh: mutate };
};
