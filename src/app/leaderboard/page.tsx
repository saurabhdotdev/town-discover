"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Medal, Star, Trophy, Zap, Search, RefreshCw, ChevronUp, Compass, Coffee, Clock } from "lucide-react";
import { CITY_CENTERS } from "@/lib/pune-location";
import { useAuth } from "@/components/auth/AuthProvider";

interface TopBadge {
  id: string;
  name: string;
  emoji: string;
  category: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  totalXp: number;
  level: number;
  levelTitle: string;
  progress: number;
  badgeCount: number;
  topBadges: TopBadge[];
}

const CITY_OPTIONS = ["All Cities", ...Object.keys(CITY_CENTERS)];

const RANK_COLORS: Record<number, string> = {
  1: "from-amber-400 via-yellow-300 to-amber-500",
  2: "from-slate-300 via-slate-200 to-slate-400",
  3: "from-amber-700 via-orange-500 to-amber-600",
};

const RANK_GLOW: Record<number, string> = {
  1: "shadow-amber-500/30",
  2: "shadow-slate-400/20",
  3: "shadow-orange-600/20",
};

const RANK_BG: Record<number, string> = {
  1: "bg-gradient-to-br from-amber-500/10 via-yellow-400/5 to-amber-600/10 border-amber-400/30",
  2: "bg-gradient-to-br from-slate-400/10 via-slate-305/5 to-slate-500/10 border-slate-400/20",
  3: "bg-gradient-to-br from-orange-600/10 via-amber-600/5 to-orange-700/10 border-orange-500/20",
};

interface Quest {
  title: string;
  desc: string;
  reward: number;
  icon: React.ReactNode;
  color: string;
  link: string;
  linkText: string;
}

const getCityQuests = (city: string): Quest[] => [
  {
    title: "🌙 Late Night Wanderer",
    desc: `Check-in or report crowd level at any street food stall or bar in ${city} after 10 PM.`,
    reward: 50,
    icon: <Clock size={16} className="text-amber-400" />,
    color: "from-amber-500/20 to-yellow-500/5 border-amber-500/30 text-amber-300",
    link: "/discover?category=food-stall",
    linkText: "Find Stalls",
  },
  {
    title: "☕ Nomad Workspace Vibe",
    desc: `Leave a rating/review at a work-friendly cafe in ${city} to help fellow remote explorers.`,
    reward: 30,
    icon: <Coffee size={16} className="text-cyan-400" />,
    color: "from-cyan-500/20 to-teal-500/5 border-cyan-500/30 text-cyan-300",
    link: "/discover?category=cafe",
    linkText: "Explore Cafes",
  },
  {
    title: "⚡ Pulse Check Curator",
    desc: `Submit a crowd report at any trending live event in ${city} to help check the city's active vibe.`,
    reward: 40,
    icon: <Compass size={16} className="text-emerald-400" />,
    color: "from-emerald-500/20 to-teal-500/5 border-emerald-500/30 text-emerald-300",
    link: "/discover?category=event",
    linkText: "View Events",
  },
];

function PodiumCard({ entry, animate }: { entry: LeaderboardEntry; animate: boolean }) {
  const heights = { 1: "h-48 md:h-56", 2: "h-36 md:h-40", 3: "h-28 md:h-32" };
  const sizes = { 1: "text-7xl", 2: "text-5xl", 3: "text-4xl" };
  const order = { 1: "order-2", 2: "order-1", 3: "order-3" };

  const podiumColors = {
    1: "from-amber-400/25 via-yellow-400/10 to-amber-500/5 border-amber-400/40",
    2: "from-slate-300/25 via-slate-200/10 to-slate-400/5 border-slate-400/30",
    3: "from-amber-700/25 via-orange-500/10 to-amber-600/5 border-orange-500/30",
  };

  const ringColors = {
    1: "ring-amber-400 shadow-amber-500/30 border-amber-400/40",
    2: "ring-slate-400 shadow-slate-300/20 border-slate-400/30",
    3: "ring-orange-600 shadow-orange-600/20 border-orange-500/30",
  };

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 40 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: entry.rank * 0.12, duration: 0.6, type: "spring", stiffness: 120 }}
      className={`${order[entry.rank as 1 | 2 | 3]} flex flex-col items-center gap-3 w-28 sm:w-32 md:w-36`}
    >
      {/* Crown/Medals */}
      <div className="h-8 flex items-end">
        {entry.rank === 1 && (
          <motion.div
            animate={{ rotate: [-6, 6, -6], y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
          >
            <Crown size={32} className="text-amber-400 fill-amber-400" />
          </motion.div>
        )}
        {entry.rank === 2 && <Medal size={26} className="text-slate-300 drop-shadow-[0_0_6px_rgba(226,232,240,0.4)]" />}
        {entry.rank === 3 && <Medal size={24} className="text-orange-500 drop-shadow-[0_0_6px_rgba(234,88,12,0.4)]" />}
      </div>

      {/* Avatar Container with Glow & Pulsing Border */}
      <div className="relative group select-none">
        {/* Glow backdrop */}
        <div className={`absolute inset-0 rounded-full blur-md opacity-40 scale-105 bg-gradient-to-tr ${RANK_COLORS[entry.rank]} transition group-hover:opacity-60 duration-300`} />
        
        <div
          className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-slate-950 font-black text-[var(--foreground)] text-2xl border-2 ring-2 ring-offset-2 ring-offset-slate-950 transition duration-300 group-hover:scale-105 ${ringColors[entry.rank as 1 | 2 | 3]}`}
        >
          {entry.fullName.charAt(0).toUpperCase()}
          
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 border-2 border-slate-950 text-xs font-black text-white shadow-md">
            {entry.rank}
          </span>
        </div>
      </div>

      {/* Profile Info */}
      <div className="text-center w-full px-1">
        <p className="truncate text-sm font-black text-[var(--foreground)] tracking-tight">
          {entry.fullName}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mt-0.5">{entry.levelTitle}</p>
        
        {/* XP Display */}
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-cyan-950/30 border border-cyan-800/30 px-2.5 py-0.5 shadow-sm">
          <Zap size={10} className="text-cyan-400 fill-cyan-400 animate-pulse" />
          <span className="text-[11px] font-black text-cyan-300">{entry.totalXp.toLocaleString()} XP</span>
        </div>

        {/* Top Badges styled as micro-tokens */}
        <div className="mt-2.5 flex justify-center gap-1.5">
          {entry.topBadges.slice(0, 3).map((b) => (
            <span
              key={b.id}
              title={b.name}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 border border-slate-800 shadow-sm text-sm"
            >
              {b.emoji}
            </span>
          ))}
        </div>
      </div>

      {/* Pedestal Stand */}
      <div
        className={`w-full rounded-t-2xl bg-gradient-to-b border border-b-0 flex items-start justify-center pt-4 relative overflow-hidden backdrop-blur-md shadow-inner ${podiumColors[entry.rank as 1 | 2 | 3]} ${heights[entry.rank as 1 | 2 | 3]}`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px] opacity-30 pointer-events-none" />
        
        <span className={`${sizes[entry.rank as 1 | 2 | 3]} font-black opacity-15 tracking-tighter text-white select-none`}>
          {entry.rank}
        </span>
      </div>
    </motion.div>
  );
}

function RankRow({ entry, isCurrentUser, animate, index }: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  animate: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, x: -16 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.4 }}
      whileHover={{ scale: 1.008, y: -1 }}
      className={`relative flex items-center gap-4 rounded-xl border p-4 shadow-sm transition-all duration-200 ${
        isCurrentUser
          ? "border-cyan-500/40 bg-gradient-to-r from-cyan-500/10 via-teal-500/5 to-slate-950/20 shadow-md shadow-cyan-900/5"
          : entry.rank <= 3
          ? `${RANK_BG[entry.rank as 1 | 2 | 3]} shadow-md`
          : "border-[var(--border)] bg-[var(--panel-soft)] hover:border-teal-500/20 hover:bg-[var(--panel)]"
      }`}
    >
      {/* Rank Indicator Badge */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${
          entry.rank <= 3
            ? `bg-gradient-to-br ${RANK_COLORS[entry.rank as 1|2|3]} text-slate-950 shadow-md`
            : "bg-[var(--panel)] text-[var(--muted-strong)] border border-[var(--border)]"
        }`}
      >
        {entry.rank <= 3 ? (
          entry.rank === 1 ? <Crown size={15} className="fill-slate-950" /> : <Medal size={15} />
        ) : (
          entry.rank
        )}
      </div>

      {/* Avatar with initial letter */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-[var(--border)] text-sm font-black text-[var(--foreground)]">
        {entry.fullName.charAt(0).toUpperCase()}
      </div>

      {/* Main Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-black text-[var(--foreground)] text-sm sm:text-base">
            {entry.fullName}
            {isCurrentUser && (
              <span className="ml-2 rounded-full bg-cyan-400 text-slate-950 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                You
              </span>
            )}
          </p>
        </div>
        <div className="mt-1 flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-black text-[var(--muted)] bg-slate-900/40 border border-slate-800 px-2 py-0.5 rounded-lg">
            Lv.{entry.level} · {entry.levelTitle}
          </span>
          <div className="flex items-center gap-1">
            {entry.topBadges.slice(0, 3).map((b) => (
              <span key={b.id} title={b.name} className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs border border-slate-850">
                {b.emoji}
              </span>
            ))}
          </div>
        </div>
        
        {/* Progress bar to next level */}
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)] p-[1px]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${entry.progress}%` }}
            transition={{ delay: index * 0.03 + 0.15, duration: 0.5, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400"
          />
        </div>
      </div>

      {/* Total XP Score */}
      <div className="shrink-0 text-right">
        <div className="flex items-center gap-1 justify-end">
          <Zap size={12} className="text-cyan-400 fill-cyan-400 animate-pulse" />
          <span className="font-black text-[var(--foreground)] text-sm sm:text-base">{entry.totalXp.toLocaleString()}</span>
        </div>
        <p className="text-[10px] font-black uppercase tracking-wide text-[var(--muted)] mt-0.5">
          {entry.badgeCount} badge{entry.badgeCount !== 1 ? "s" : ""}
        </p>
      </div>
    </motion.div>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cityFilter, setCityFilter] = useState("All Cities");
  const [search, setSearch] = useState("");
  const [animate, setAnimate] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    setAnimate(true);
    try {
      const city = cityFilter !== "All Cities" ? `&city=${encodeURIComponent(cityFilter)}` : "";
      const res = await fetch(`/api/leaderboard?limit=50${city}`, {
        cache: forceRefresh ? "no-store" : "default",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load leaderboard.");
      setData(json.leaderboard || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((e) => e.fullName.toLowerCase().includes(q));
  }, [data, search]);

  const top3 = filtered.slice(0, 3);
  const myEntry = user ? data.find((e) => e.userId === (user as any).id) : null;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[var(--border)] bg-gradient-to-br from-amber-500/5 via-[var(--background)] to-cyan-500/5 pb-6 pt-8">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-20 right-1/4 h-40 w-40 rounded-full bg-cyan-500/10 blur-2xl" />

        <div className="mx-auto max-w-screen-lg px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-amber-300">
              <Trophy size={14} />
              Hall of Fame
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl md:text-5xl">
              Sheher Explorers
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
              Top city discoverers ranked by XP earned across Indian cities.
            </p>
          </motion.div>

          {/* My Rank chip */}
          {myEntry && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="mx-auto mt-4 flex w-fit items-center gap-3 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-5 py-2"
            >
              <ChevronUp size={16} className="text-cyan-400" />
              <span className="text-sm font-black text-cyan-200">
                Your Rank: #{myEntry.rank} · {myEntry.totalXp.toLocaleString()} XP
              </span>
              <Zap size={14} className="text-cyan-400" />
            </motion.div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-screen-lg px-4 py-8">
        {/* Controls */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* City filter pills */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {CITY_OPTIONS.map((city) => (
              <button
                key={city}
                onClick={() => setCityFilter(city)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${
                  cityFilter === city
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
                }`}
              >
                {city}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <label className="relative flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search explorer..."
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] pl-8 pr-3 text-xs font-semibold text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-teal-400 sm:w-48"
              />
            </label>

            {/* Refresh */}
            <button
              onClick={() => fetchLeaderboard(true)}
              disabled={refreshing}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] transition hover:bg-[var(--panel)] disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--panel-soft)]" />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-8 text-center">
            <p className="font-black text-rose-300">{error}</p>
            <button
              onClick={() => fetchLeaderboard()}
              className="mt-4 rounded-lg bg-rose-500 px-5 py-2 text-sm font-black text-white transition hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-12 text-center">
            <Trophy size={48} className="mx-auto mb-4 text-[var(--muted)]" />
            <h2 className="text-xl font-black text-[var(--foreground)]">No explorers yet</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Be the first to earn XP and claim the top spot!
            </p>
          </div>
        )}

        {/* City Quests Panel */}
        {!loading && !error && filtered.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
              <Zap size={14} className="text-cyan-400" /> Active City Quests in {cityFilter === "All Cities" ? "Pune" : cityFilter}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {getCityQuests(cityFilter === "All Cities" ? "Pune" : cityFilter).map((quest, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 + 0.1, duration: 0.4 }}
                  whileHover={{ y: -3 }}
                  className={`rounded-2xl border p-4 bg-gradient-to-br ${quest.color} flex flex-col justify-between min-h-[160px] shadow-lg`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-xl bg-slate-950/85 border border-slate-800 shadow-sm shrink-0 flex items-center justify-center">
                        {quest.icon}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest bg-cyan-950/50 text-cyan-300 border border-cyan-800/30 px-2.5 py-1 rounded-full shadow-inner flex items-center gap-0.5">
                        +{quest.reward} XP <Zap size={8} className="fill-cyan-300 text-cyan-300 shrink-0" />
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-[var(--foreground)] tracking-tight">{quest.title}</h3>
                    <p className="text-[11px] font-semibold text-[var(--muted-strong)] leading-relaxed">{quest.desc}</p>
                  </div>
                  
                  <a
                    href={quest.link}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 px-3 py-2 text-xs font-black text-[var(--foreground)] transition cursor-pointer text-center"
                  >
                    <Compass size={12} className="text-teal-400" />
                    {quest.linkText}
                  </a>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Podium — top 3 */}
        {!loading && !error && top3.length >= 1 && (
          <div className="mb-12 border-t border-[var(--border)] pt-8">
            <h2 className="mb-6 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
              <Star size={14} className="text-amber-400" /> Top Explorers
            </h2>
            <div className="no-scrollbar overflow-x-auto pb-2">
              <div className="flex min-w-[340px] items-end justify-center gap-3 pb-4 sm:gap-4 md:gap-6">
                {[
                  top3.find((e) => e.rank === 2),
                  top3.find((e) => e.rank === 1),
                  top3.find((e) => e.rank === 3),
                ]
                  .filter(Boolean)
                  .map((entry) => (
                    <PodiumCard key={entry!.rank} entry={entry!} animate={animate} />
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Full list */}
        {!loading && !error && filtered.length > 0 && (
          <div className="border-t border-[var(--border)] pt-8">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
              <Trophy size={14} className="text-[var(--muted)]" /> Full Rankings
            </h2>
            <div className="space-y-2">
              <AnimatePresence>
                {filtered.map((entry, i) => (
                  <RankRow
                    key={entry.userId}
                    entry={entry}
                    isCurrentUser={!!(user && entry.userId === (user as any).id)}
                    animate={animate}
                    index={i}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Stats summary */}
        {!loading && !error && data.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 grid grid-cols-3 gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-5"
          >
            {[
              {
                label: "Explorers",
                value: data.length,
                icon: <Trophy size={18} className="text-amber-400" />,
              },
              {
                label: "Total XP",
                value: `${(data.reduce((sum, e) => sum + e.totalXp, 0) / 1000).toFixed(1)}K`,
                icon: <Zap size={18} className="text-cyan-400" />,
              },
              {
                label: "Avg. Level",
                value: Math.round(data.reduce((sum, e) => sum + e.level, 0) / data.length),
                icon: <Star size={18} className="text-teal-400" />,
              },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex justify-center mb-1">{stat.icon}</div>
                <p className="text-xl font-black text-[var(--foreground)]">{stat.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
