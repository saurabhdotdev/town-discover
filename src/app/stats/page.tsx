"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Coffee,
  Flame,
  IceCreamCone,
  MapPin,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Trophy,
  UtensilsCrossed,
  Users,
  Zap,
} from "lucide-react";
import { CITY_CENTERS } from "@/lib/pune-location";
import { getFallbackPlacesForCity } from "@/lib/client/fallback-places";
import { Place } from "@/types";
import { getCategoryLabel } from "@/lib/utils";

const CITY_OPTIONS = Object.keys(CITY_CENTERS);

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  cafe: <Coffee size={14} />,
  restaurant: <UtensilsCrossed size={14} />,
  "ice-cream": <IceCreamCone size={14} />,
  dessert: <IceCreamCone size={14} />,
  "street-food": <Store size={14} />,
  "food-stall": <Store size={14} />,
  event: <Sparkles size={14} />,
  bar: <Flame size={14} />,
  nightlife: <Flame size={14} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  cafe: "from-amber-500 to-yellow-400",
  restaurant: "from-emerald-500 to-green-400",
  "ice-cream": "from-pink-500 to-rose-400",
  dessert: "from-pink-500 to-rose-400",
  "street-food": "from-orange-500 to-amber-400",
  "food-stall": "from-orange-500 to-amber-400",
  event: "from-purple-500 to-violet-400",
  bar: "from-rose-500 to-red-400",
  nightlife: "from-rose-500 to-red-400",
};

const CATEGORY_BG: Record<string, string> = {
  cafe: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  restaurant: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "ice-cream": "bg-pink-500/15 text-pink-300 border-pink-500/25",
  dessert: "bg-pink-500/15 text-pink-300 border-pink-500/25",
  "street-food": "bg-orange-500/15 text-orange-300 border-orange-500/25",
  "food-stall": "bg-orange-500/15 text-orange-300 border-orange-500/25",
  event: "bg-purple-500/15 text-purple-300 border-purple-500/25",
  bar: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  nightlife: "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

function AnimatedCounter({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const step = value / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{display.toLocaleString()}</span>;
}

function CategoryBar({ category, count, max, rank }: { category: string; count: number; max: number; rank: number }) {
  const pct = Math.round((count / max) * 100);
  const gradientClass = CATEGORY_COLORS[category] || "from-teal-500 to-cyan-400";
  const bgClass = CATEGORY_BG[category] || "bg-teal-500/15 text-teal-300 border-teal-500/25";
  const icon = CATEGORY_ICONS[category] || <MapPin size={14} />;
  const label = getCategoryLabel(category as any, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.06, duration: 0.4 }}
      className="flex items-center gap-3"
    >
      <div className="flex items-center gap-2 w-32 shrink-0">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs ${bgClass}`}>
          {icon}
        </span>
        <span className="text-xs font-bold text-[var(--foreground)] truncate">{label}</span>
      </div>
      <div className="flex-1 relative h-7 rounded-lg bg-[var(--panel-soft)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: rank * 0.06 + 0.2, duration: 0.7, ease: "easeOut" }}
          className={`absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r ${gradientClass} opacity-80`}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--foreground)] mix-blend-plus-lighter">
          {count}
        </span>
      </div>
      <span className="text-[10px] font-black text-[var(--muted)] w-8 text-right shrink-0">{pct}%</span>
    </motion.div>
  );
}

function HourHeatmap({ places }: { places: Place[] }) {
  // Simulate peak hour data based on place categories
  const hours = Array.from({ length: 24 }, (_, h) => {
    let score = 0;
    places.forEach((p) => {
      const hasHours = p.hours;
      if (!hasHours) return;
      const open = parseInt(p.hours!.open.split(":")[0]);
      const close = parseInt(p.hours!.close.split(":")[0]);
      if (h >= open && h <= close) score += 1;
    });
    // Apply time-of-day multipliers for realism
    const multiplier =
      h >= 8 && h <= 10 ? 1.4 :
      h >= 12 && h <= 14 ? 2.0 :
      h >= 17 && h <= 21 ? 2.5 :
      h >= 22 ? 1.8 :
      0.6;
    return { hour: h, score: Math.round(score * multiplier + Math.random() * 5) };
  });

  const max = Math.max(...hours.map(h => h.score));

  const timeLabel = (h: number) => {
    if (h === 0) return "12a";
    if (h < 12) return `${h}a`;
    if (h === 12) return "12p";
    return `${h - 12}p`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 h-20">
        {hours.map(({ hour, score }, idx) => {
          const pct = max > 0 ? (score / max) : 0;
          const isPeak = pct > 0.7;
          const isActive = hour >= 17 && hour <= 22;
          return (
            <motion.div
              key={hour}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: idx * 0.025, duration: 0.4, ease: "easeOut" }}
              style={{ originY: 1 }}
              className="flex-1 flex flex-col items-center gap-0.5"
              title={`${timeLabel(hour)}: ${score} active spots`}
            >
              <div
                className={`w-full rounded-sm transition-colors ${
                  isPeak
                    ? "bg-gradient-to-t from-teal-500 to-cyan-400"
                    : isActive
                    ? "bg-gradient-to-t from-teal-500/60 to-cyan-400/40"
                    : "bg-[var(--panel-soft)]"
                }`}
                style={{ height: `${Math.max(4, pct * 100)}%` }}
              />
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[9px] font-bold text-[var(--muted)]">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>11p</span>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [selectedCity, setSelectedCity] = useState("Pune");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getFallbackPlacesForCity(selectedCity as any).then((data) => {
      setPlaces(data);
      setLoading(false);
    });
  }, [selectedCity]);

  const stats = useMemo(() => {
    if (!places.length) return null;

    const categoryCounts: Record<string, number> = {};
    places.forEach((p) => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    });

    const sortedCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1]);
    const maxCount = sortedCategories[0]?.[1] || 1;

    const localities: Record<string, number> = {};
    places.forEach((p) => {
      if (p.locality) localities[p.locality] = (localities[p.locality] || 0) + 1;
    });
    const topLocalities = Object.entries(localities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const trending = places.filter((p) => p.isTrending);
    const topRated = [...places].sort((a, b) => b.rating - a.rating).slice(0, 5);
    const avgRating = places.length
      ? (places.reduce((sum, p) => sum + p.rating, 0) / places.length).toFixed(1)
      : "0";
    const openNow = places.filter((p) => p.isOpen).length;

    return { categoryCounts, sortedCategories, maxCount, topLocalities, trending, topRated, avgRating, openNow };
  }, [places]);

  return (
    <div className="w-full max-w-full min-h-screen overflow-x-hidden">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[var(--border)] bg-gradient-to-br from-teal-500/5 via-[var(--background)] to-purple-500/5 pb-6 pt-8">
        <div className="pointer-events-none absolute -top-24 left-1/3 h-64 w-64 rounded-full bg-teal-400/8 blur-3xl" />
        <div className="pointer-events-none absolute -top-16 right-1/4 h-48 w-48 rounded-full bg-purple-500/8 blur-2xl" />

        <div className="mx-auto max-w-screen-lg px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-teal-300">
              <BarChart3 size={14} />
              City Intelligence
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl md:text-5xl">
              City Stats Dashboard
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
              Live city insights — category breakdowns, peak hours, and top-rated spots.
            </p>
          </motion.div>

          {/* City filter */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {CITY_OPTIONS.map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`rounded-full px-4 py-2 text-xs font-black transition-all ${
                  selectedCity === city
                    ? "bg-teal-500 text-slate-950 shadow-[0_0_12px_rgba(45,212,191,0.3)]"
                    : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)] hover:text-[var(--foreground)]"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-screen-lg px-4 py-8 space-y-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--panel-soft)]" />
            ))}
          </div>
        ) : !stats ? null : (
          <>
            {/* KPI Cards */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {[
                {
                  label: "Total Places",
                  value: places.length,
                  icon: <MapPin size={18} className="text-teal-400" />,
                  suffix: "",
                  color: "border-teal-500/20 bg-teal-500/5",
                },
                {
                  label: "Trending Now",
                  value: stats.trending.length,
                  icon: <Flame size={18} className="text-rose-400" />,
                  suffix: "",
                  color: "border-rose-500/20 bg-rose-500/5",
                },
                {
                  label: "Avg. Rating",
                  value: parseFloat(stats.avgRating),
                  icon: <Star size={18} className="text-amber-400" />,
                  suffix: "/5",
                  color: "border-amber-500/20 bg-amber-500/5",
                },
                {
                  label: "Open Right Now",
                  value: stats.openNow,
                  icon: <Zap size={18} className="text-emerald-400" />,
                  suffix: "",
                  color: "border-emerald-500/20 bg-emerald-500/5",
                },
              ].map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                  className={`rounded-2xl border p-4 ${kpi.color}`}
                >
                  <div className="mb-2">{kpi.icon}</div>
                  <p className="text-2xl font-black text-[var(--foreground)]">
                    <AnimatedCounter value={kpi.value} />
                    {kpi.suffix}
                  </p>
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                    {kpi.label}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* Category Breakdown */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
                  <BarChart3 size={14} className="text-teal-400" />
                  Category Breakdown
                </h2>
                <div className="space-y-2.5">
                  {stats.sortedCategories.map(([cat, count], i) => (
                    <CategoryBar
                      key={cat}
                      category={cat}
                      count={count}
                      max={stats.maxCount}
                      rank={i}
                    />
                  ))}
                </div>
              </div>

              {/* Peak Hours */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
                  <TrendingUp size={14} className="text-purple-400" />
                  Activity by Hour
                </h2>
                <HourHeatmap places={places} />
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-teal-300">
                    <span className="h-3 w-3 rounded-sm bg-gradient-to-t from-teal-500 to-cyan-400" />
                    Peak hours (5 PM–10 PM)
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-[var(--muted)]">
                    <span className="h-3 w-3 rounded-sm bg-[var(--panel-soft)] border border-[var(--border)]" />
                    Low activity
                  </div>
                </div>
              </div>
            </div>

            {/* Top-rated + Top Localities */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Top Rated */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
                  <Trophy size={14} className="text-amber-400" />
                  Top Rated Places
                </h2>
                <div className="space-y-2">
                  {stats.topRated.map((place, i) => (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3"
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                          i === 0
                            ? "bg-amber-400 text-slate-950"
                            : i === 1
                            ? "bg-slate-300 text-slate-950"
                            : i === 2
                            ? "bg-orange-500 text-white"
                            : "bg-[var(--panel-soft)] text-[var(--muted-strong)] border border-[var(--border)]"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[var(--foreground)]">{place.title}</p>
                        <p className="text-[10px] text-[var(--muted)]">{place.locality}</p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-black text-amber-400">
                        <Star size={12} className="fill-amber-400" />
                        {place.rating}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Top Localities */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
                  <Users size={14} className="text-cyan-400" />
                  Most Active Areas
                </h2>
                <div className="space-y-2.5">
                  {stats.topLocalities.map(([locality, count], i) => {
                    const maxLoc = stats.topLocalities[0]?.[1] || 1;
                    const pct = Math.round((count / maxLoc) * 100);
                    return (
                      <motion.div
                        key={locality}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-3"
                      >
                        <span className="w-24 shrink-0 truncate text-xs font-bold text-[var(--foreground)]">{locality}</span>
                        <div className="flex-1 relative h-6 rounded-lg bg-[var(--panel)] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: i * 0.06 + 0.15, duration: 0.6, ease: "easeOut" }}
                            className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 opacity-75"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--foreground)] mix-blend-plus-lighter">
                            {count}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Trending places spotlight */}
            {stats.trending.length > 0 && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-rose-300">
                  <Flame size={14} className="text-rose-400" />
                  Trending Spots in {selectedCity}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {stats.trending.slice(0, 6).map((place, i) => {
                    const bgClass = CATEGORY_BG[place.category] || "bg-teal-500/15 text-teal-300 border-teal-500/25";
                    return (
                      <motion.div
                        key={place.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3"
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs ${bgClass}`}>
                          {CATEGORY_ICONS[place.category] || <MapPin size={14} />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-[var(--foreground)]">{place.title}</p>
                          <p className="text-[10px] text-[var(--muted)] truncate">{place.locality}</p>
                        </div>
                        {place.rating > 0 && (
                          <span className="ml-auto shrink-0 flex items-center gap-0.5 text-[11px] font-black text-amber-400">
                            <Star size={9} className="fill-amber-400" />
                            {place.rating}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
