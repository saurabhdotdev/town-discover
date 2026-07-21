"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LeaderboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profile?tab=leaderboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
      <p className="text-sm font-semibold text-[var(--muted)]">Redirecting to Hall of Fame...</p>
    </div>
  );
}
