"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  RefreshCw,
  Clock,
  Cloud,
  Wind,
  Droplets,
  Activity,
  Navigation,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { CITY_CENTERS, SupportedCityName } from "@/lib/pune-location";
import { Place } from "@/types";
import { getCategoryLabel } from "@/lib/utils";
import { useCitySelection } from "@/hooks/useCitySelection";
import { Header } from "@/components/common/Header";

const CITY_OPTIONS = Object.keys(CITY_CENTERS) as SupportedCityName[];

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

// ── Animated counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ value, decimals = 0, duration = 1.0 }: { value: number; decimals?: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    let start = from;
    const step = (value - from) / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      const done = step > 0 ? start >= value : start <= value;
      if (done) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(parseFloat(start.toFixed(decimals)));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [value, duration, decimals]);

  return <span>{decimals > 0 ? display.toFixed(decimals) : display.toLocaleString()}</span>;
}

// ── Live clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = time.getHours();
  const m = time.getMinutes().toString().padStart(2, "0");
  const s = time.getSeconds().toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-black text-white tabular-nums">{h12}:{m}</span>
      <span className="text-sm font-black text-white/60 tabular-nums">{s}</span>
      <span className="text-xs font-black text-teal-400">{period}</span>
    </div>
  );
}

// ── Category bar ──────────────────────────────────────────────────────────────
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
      transition={{ delay: rank * 0.055, duration: 0.4 }}
      className="flex items-center gap-3 group"
    >
      <div className="flex items-center gap-2 w-28 shrink-0">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs ${bgClass}`}>{icon}</span>
        <span className="text-xs font-bold text-[var(--foreground)] truncate">{label}</span>
      </div>
      <div className="flex-1 relative h-7 rounded-lg bg-[var(--panel-soft)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: rank * 0.055 + 0.15, duration: 0.65, ease: "easeOut" }}
          className={`absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r ${gradientClass} opacity-80`}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-white mix-blend-plus-lighter">
          {count}
        </span>
      </div>
      <span className="text-[10px] font-black text-[var(--muted)] w-8 text-right shrink-0">{pct}%</span>
    </motion.div>
  );
}

// ── Activity heatmap ──────────────────────────────────────────────────────────
function ActivityHeatmap({ places, currentHour }: { places: Place[]; currentHour: number }) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => {
    let score = 0;
    places.forEach((p) => {
      if (!p.hours) return;
      const open = parseInt(p.hours.open.split(":")[0]);
      const close = parseInt(p.hours.close.split(":")[0]);
      if (h >= open && h <= close) score += 1;
    });
    const multiplier =
      h >= 7 && h <= 9 ? 1.3 :
      h >= 12 && h <= 14 ? 1.9 :
      h >= 17 && h <= 21 ? 2.6 :
      h >= 22 ? 1.5 :
      h >= 0 && h <= 5 ? 0.2 :
      0.7;
    return { hour: h, score: Math.round(score * multiplier) };
  }), [places]);

  const max = Math.max(...hours.map(h => h.score), 1);
  const timeLabel = (h: number) => {
    if (h === 0) return "12a";
    if (h < 12) return `${h}a`;
    if (h === 12) return "12p";
    return `${h - 12}p`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-0.5 h-24">
        {hours.map(({ hour, score }, idx) => {
          const pct = score / max;
          const isCurrent = hour === currentHour;
          const isPeak = pct > 0.7;
          return (
            <motion.div
              key={hour}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: idx * 0.018, duration: 0.35, ease: "easeOut" }}
              style={{ originY: 1 }}
              className="flex-1 flex flex-col items-center gap-0.5 cursor-default"
              title={`${timeLabel(hour)}: ~${score} places open`}
            >
              <div
                className={`w-full rounded-sm transition-colors relative ${
                  isCurrent
                    ? "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)]"
                    : isPeak
                    ? "bg-gradient-to-t from-teal-600 to-cyan-400"
                    : "bg-[var(--panel-soft)]"
                }`}
                style={{ height: `${Math.max(6, pct * 100)}%` }}
              />
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[9px] font-bold text-[var(--muted)]">
        <span>12a</span><span>4a</span><span>8a</span><span>12p</span><span>4p</span><span>8p</span><span>11p</span>
      </div>
      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5 text-[10px] font-black text-teal-300">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.5)]" />
          Now ({timeLabel(currentHour)})
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-black text-cyan-300">
          <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-teal-600 to-cyan-400" />
          Peak hours
        </div>
      </div>
    </div>
  );
}

// ── Weather mini-card ─────────────────────────────────────────────────────────
type WeatherSnapshot = {
  temp: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  icon: string;
};

function WeatherCard({ city }: { city: string }) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setWeather(null);
    fetch(`/api/weather?city=${encodeURIComponent(city)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.current) {
          setWeather({
            temp: data.current.temperature,
            humidity: data.current.humidity,
            windSpeed: data.current.windSpeed,
            condition: data.current.condition,
            icon: data.current.icon,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [city]);

  if (loading) return (
    <div className="animate-pulse h-20 rounded-2xl bg-[var(--panel-soft)]" />
  );
  if (!weather) return null;

  return (
    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 flex items-center gap-4">
      <div className="text-4xl leading-none">{weather.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-sky-400">Live Weather · {city}</p>
        <p className="text-xl font-black text-white mt-0.5">{weather.temp}°C <span className="text-sm font-semibold text-sky-300">{weather.condition}</span></p>
      </div>
      <div className="text-right space-y-1 shrink-0">
        <div className="flex items-center gap-1 justify-end text-[10px] font-bold text-slate-400">
          <Droplets size={10} className="text-sky-400" />
          {weather.humidity}%
        </div>
        <div className="flex items-center gap-1 justify-end text-[10px] font-bold text-slate-400">
          <Wind size={10} className="text-sky-400" />
          {weather.windSpeed} km/h
        </div>
      </div>
    </div>
  );
}

// ── Price range distribution ──────────────────────────────────────────────────
function PriceDistribution({ places }: { places: Place[] }) {
  const dist = useMemo(() => {
    const counts: Record<string, number> = { "$": 0, "$$": 0, "$$$": 0, "$$$$": 0 };
    places.forEach(p => {
      const r = p.priceRange;
      if (r && counts[r] !== undefined) counts[r]++;
      else if (r) counts["$$"]++;
      else counts["$$"]++;
    });
    return Object.entries(counts).filter(([, v]) => v > 0);
  }, [places]);

  const maxVal = Math.max(...dist.map(([, v]) => v), 1);
  const labels: Record<string, string> = { "$": "Budget", "$$": "Midrange", "$$$": "Premium", "$$$$": "Luxury" };
  const colors: Record<string, string> = {
    "$": "from-emerald-500 to-green-400",
    "$$": "from-teal-500 to-cyan-400",
    "$$$": "from-amber-500 to-yellow-400",
    "$$$$": "from-rose-500 to-red-400",
  };

  return (
    <div className="space-y-2.5">
      {dist.map(([range, count], i) => (
        <motion.div
          key={range}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="flex items-center gap-3"
        >
          <span className="w-20 shrink-0 text-xs font-bold text-[var(--foreground)]">
            {range} <span className="text-[var(--muted)] font-normal">{labels[range]}</span>
          </span>
          <div className="flex-1 relative h-6 rounded-lg bg-[var(--panel-soft)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(count / maxVal) * 100}%` }}
              transition={{ delay: i * 0.06 + 0.12, duration: 0.6, ease: "easeOut" }}
              className={`absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r ${colors[range] || "from-teal-500 to-cyan-400"} opacity-75`}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-white mix-blend-plus-lighter">{count}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const { selectedCity: activeCity, chooseCity } = useCitySelection();
  const [selectedCity, setSelectedCity] = useState(() => activeCity);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [currentMinute, setCurrentMinute] = useState(new Date().getMinutes());

  // Sync city selector with global city
  useEffect(() => { setSelectedCity(activeCity); }, [activeCity]);

  // Update current hour every minute for live "open now" calculations
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentHour(new Date().getHours());
      setCurrentMinute(new Date().getMinutes());
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const fetchPlaces = useCallback(async (city: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    let loaded = false;

    try {
      const center = CITY_CENTERS[city as SupportedCityName];
      const lat = center?.latitude ?? 18.5204;
      const lng = center?.longitude ?? 73.8567;

      const res = await fetch(
        `/api/places/osm?city=${encodeURIComponent(city)}&lat=${lat}&lng=${lng}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        // API may return { places: [] } or just []
        const allPlaces: Place[] = Array.isArray(data)
          ? data
          : (data.places ?? data.items ?? []);
        if (allPlaces.length > 0) {
          setPlaces(allPlaces);
          setLastFetched(new Date());
          loaded = true;
        }
      }
    } catch { /* fall through */ }

    // Fallback to static mock data if live fetch returned nothing
    if (!loaded) {
      try {
        const { getFallbackPlacesForCity } = await import("@/lib/client/fallback-places");
        const fallback = await getFallbackPlacesForCity(city as any);
        setPlaces(fallback);
        setLastFetched(new Date());
      } catch { /**/ }
    }

    // Always clear loading
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchPlaces(selectedCity); }, [selectedCity, fetchPlaces]);

  // Compute open-now dynamically using current hour
  const isOpenNow = useCallback((place: Place): boolean => {
    if (place.isOpen !== undefined) return place.isOpen;
    if (!place.hours) return false;
    try {
      const open = parseInt(place.hours.open.split(":")[0]);
      const close = parseInt(place.hours.close.split(":")[0]);
      if (close > open) return currentHour >= open && currentHour < close;
      return currentHour >= open || currentHour < close; // crosses midnight
    } catch { return false; }
  }, [currentHour]);

  const stats = useMemo(() => {
    if (!places.length) return null;

    const categoryCounts: Record<string, number> = {};
    places.forEach(p => { categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1; });
    const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    const maxCount = sortedCategories[0]?.[1] || 1;

    const localities: Record<string, number> = {};
    places.forEach(p => { if (p.locality) localities[p.locality] = (localities[p.locality] || 0) + 1; });
    const topLocalities = Object.entries(localities).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const trending = places.filter(p => p.isTrending);
    const topRated = [...places].sort((a, b) => b.rating - a.rating).slice(0, 5);
    const avgRating = (places.reduce((s, p) => s + (p.rating || 0), 0) / places.length);
    const openNowList = places.filter(isOpenNow);
    const openNow = openNowList.length;

    // Veg-friendly count
    const vegFriendly = places.filter(p => p.tags?.includes("veg") || p.tags?.includes("pure-veg")).length;

    // Rating distribution
    const ratingBuckets = { "4.5+": 0, "4.0–4.4": 0, "3.5–3.9": 0, "< 3.5": 0 };
    places.forEach(p => {
      if (!p.rating) return;
      if (p.rating >= 4.5) ratingBuckets["4.5+"]++;
      else if (p.rating >= 4.0) ratingBuckets["4.0–4.4"]++;
      else if (p.rating >= 3.5) ratingBuckets["3.5–3.9"]++;
      else ratingBuckets["< 3.5"]++;
    });

    return {
      categoryCounts, sortedCategories, maxCount, topLocalities,
      trending, topRated, avgRating, openNow, vegFriendly, ratingBuckets, openNowList,
    };
  }, [places, isOpenNow]);

  const timeStr = lastFetched
    ? lastFetched.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="w-full max-w-full min-h-screen overflow-x-hidden bg-[var(--background)]">
      <Header title="City Stats" eyebrow="Live City Intelligence" showLocation={false} />

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-[var(--border)] bg-gradient-to-br from-teal-500/8 via-[var(--background)] to-purple-500/6 pb-6 pt-8">
        <div className="pointer-events-none absolute -top-24 left-1/3 h-64 w-64 rounded-full bg-teal-400/8 blur-3xl" />
        <div className="pointer-events-none absolute -top-16 right-1/4 h-48 w-48 rounded-full bg-purple-500/8 blur-2xl" />

        <div className="mx-auto max-w-screen-lg px-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-teal-300">
                <BarChart3 size={14} />
                Live City Intelligence
              </div>
              <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
                {selectedCity} Stats
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {places.length > 0 ? `${places.length} places · real-time data` : "Loading live data..."}
                {timeStr && <span className="ml-2 text-teal-400 font-semibold">· Updated {timeStr}</span>}
              </p>
            </motion.div>

            {/* Live clock + refresh */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2.5">
                <Clock size={14} className="text-teal-400" />
                <LiveClock />
              </div>
              <button
                type="button"
                onClick={() => fetchPlaces(selectedCity, true)}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-2xl border border-teal-500/30 bg-teal-500/10 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-teal-400 hover:bg-teal-500/15 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </motion.div>
          </div>

          {/* City filter pills */}
          <div className="mt-5 flex flex-wrap gap-2">
            {CITY_OPTIONS.map((city) => (
              <button
                key={city}
                onClick={() => { setSelectedCity(city); chooseCity(city); }}
                className={`rounded-full px-4 py-1.5 text-xs font-black transition-all cursor-pointer ${
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

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-screen-lg px-4 py-8 space-y-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--panel-soft)]" />
            ))}
          </div>
        ) : !stats ? null : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedCity}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="space-y-8"
            >
              {/* ── KPI cards ─────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  {
                    label: "Total Spots",
                    value: places.length,
                    icon: <MapPin size={16} className="text-teal-400" />,
                    color: "border-teal-500/20 bg-teal-500/5",
                    decimals: 0,
                  },
                  {
                    label: "Open Now",
                    value: stats.openNow,
                    icon: <Zap size={16} className="text-emerald-400" />,
                    color: "border-emerald-500/20 bg-emerald-500/5",
                    decimals: 0,
                    pulse: true,
                  },
                  {
                    label: "Trending",
                    value: stats.trending.length,
                    icon: <Flame size={16} className="text-rose-400" />,
                    color: "border-rose-500/20 bg-rose-500/5",
                    decimals: 0,
                  },
                  {
                    label: "Avg Rating",
                    value: stats.avgRating,
                    icon: <Star size={16} className="text-amber-400" />,
                    color: "border-amber-500/20 bg-amber-500/5",
                    decimals: 1,
                    suffix: "/5",
                  },
                  {
                    label: "Veg Friendly",
                    value: stats.vegFriendly,
                    icon: <Store size={16} className="text-green-400" />,
                    color: "border-green-500/20 bg-green-500/5",
                    decimals: 0,
                  },
                  {
                    label: "Neighbourhoods",
                    value: stats.topLocalities.length,
                    icon: <Navigation size={16} className="text-purple-400" />,
                    color: "border-purple-500/20 bg-purple-500/5",
                    decimals: 0,
                  },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, scale: 0.93 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    className={`rounded-2xl border p-4 relative overflow-hidden ${kpi.color}`}
                  >
                    {(kpi as any).pulse && (
                      <span className="absolute top-3 right-3 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                      </span>
                    )}
                    <div className="mb-2">{kpi.icon}</div>
                    <p className="text-xl font-black text-[var(--foreground)] tabular-nums">
                      <AnimatedCounter value={kpi.value as number} decimals={kpi.decimals} />
                      {(kpi as any).suffix}
                    </p>
                    <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--muted)]">{kpi.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* ── Live weather ───────────────────────────── */}
              <WeatherCard city={selectedCity} />

              {/* ── Activity heatmap + Category breakdown ─── */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
                      <Activity size={14} className="text-teal-400" />
                      Live Activity by Hour
                    </h2>
                    <span className="text-[9px] font-black uppercase tracking-widest text-teal-400 bg-teal-400/10 px-2 py-1 rounded-full border border-teal-400/20">
                      Now: {currentHour % 12 || 12}{currentHour >= 12 ? "PM" : "AM"}
                    </span>
                  </div>
                  <ActivityHeatmap places={places} currentHour={currentHour} />
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
                    <BarChart3 size={14} className="text-teal-400" />
                    Category Breakdown
                  </h2>
                  <div className="space-y-2.5">
                    {stats.sortedCategories.map(([cat, count], i) => (
                      <CategoryBar key={cat} category={cat} count={count} max={stats.maxCount} rank={i} />
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Top rated + Price Distribution ─────────── */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
                    <Trophy size={14} className="text-amber-400" />
                    Top Rated Spots
                  </h2>
                  <div className="space-y-2">
                    {stats.topRated.map((place, i) => (
                      <motion.div
                        key={place.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 hover:border-amber-500/30 transition-colors group"
                      >
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                          i === 0 ? "bg-amber-400 text-slate-950"
                          : i === 1 ? "bg-slate-300 text-slate-950"
                          : i === 2 ? "bg-orange-500 text-white"
                          : "bg-[var(--panel-soft)] text-[var(--muted-strong)] border border-[var(--border)]"
                        }`}>
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-[var(--foreground)]">{place.title}</p>
                          <p className="text-[10px] text-[var(--muted)]">{place.locality}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex items-center gap-1 text-sm font-black text-amber-400">
                            <Star size={11} className="fill-amber-400" />
                            {place.rating}
                          </div>
                          {isOpenNow(place) && (
                            <span className="text-[8px] font-black text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">OPEN</span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
                    <TrendingUp size={14} className="text-cyan-400" />
                    Price Range Distribution
                  </h2>
                  <PriceDistribution places={places} />

                  <div className="mt-6 pt-4 border-t border-[var(--border)]">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--muted)]">
                      <Star size={11} className="text-amber-400" />
                      Rating Distribution
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(stats.ratingBuckets).map(([label, count], i) => {
                        const maxBucket = Math.max(...Object.values(stats.ratingBuckets), 1);
                        return (
                          <motion.div
                            key={label}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center gap-3"
                          >
                            <span className="w-16 shrink-0 text-[11px] font-bold text-[var(--foreground)] tabular-nums">{label}</span>
                            <div className="flex-1 relative h-5 rounded-lg bg-[var(--panel)] overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(count / maxBucket) * 100}%` }}
                                transition={{ delay: i * 0.05 + 0.1, duration: 0.55, ease: "easeOut" }}
                                className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 opacity-70"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-white mix-blend-plus-lighter">{count}</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Most active neighbourhoods ──────────────── */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--muted)]">
                  <Users size={14} className="text-cyan-400" />
                  Most Active Neighbourhoods
                </h2>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {stats.topLocalities.map(([locality, count], i) => {
                    const maxLoc = stats.topLocalities[0]?.[1] || 1;
                    const pct = Math.round((count / maxLoc) * 100);
                    return (
                      <motion.div
                        key={locality}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3"
                      >
                        <span className="w-28 shrink-0 truncate text-xs font-bold text-[var(--foreground)]">{locality}</span>
                        <div className="flex-1 relative h-6 rounded-lg bg-[var(--panel)] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: i * 0.05 + 0.1, duration: 0.6, ease: "easeOut" }}
                            className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 opacity-70"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-white mix-blend-plus-lighter">{count}</span>
                        </div>
                        <span className="text-[10px] font-black text-[var(--muted)] w-8 text-right shrink-0">{pct}%</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* ── Trending spotlight ──────────────────────── */}
              {stats.trending.length > 0 && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-rose-300">
                    <Flame size={14} className="text-rose-400 animate-pulse" />
                    Trending in {selectedCity}
                    <span className="ml-auto text-[9px] font-black text-rose-400 bg-rose-400/10 px-2 py-1 rounded-full border border-rose-400/20">
                      {stats.trending.length} spots
                    </span>
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {stats.trending.slice(0, 9).map((place, i) => {
                      const bgClass = CATEGORY_BG[place.category] || "bg-teal-500/15 text-teal-300 border-teal-500/25";
                      return (
                        <motion.div
                          key={place.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.055 }}
                          className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 hover:border-rose-500/30 transition-colors"
                        >
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs ${bgClass}`}>
                            {CATEGORY_ICONS[place.category] || <MapPin size={14} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black text-[var(--foreground)]">{place.title}</p>
                            <p className="text-[10px] text-[var(--muted)] truncate">{place.locality}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {place.rating > 0 && (
                              <span className="flex items-center gap-0.5 text-[11px] font-black text-amber-400">
                                <Star size={9} className="fill-amber-400" />{place.rating}
                              </span>
                            )}
                            {isOpenNow(place) && (
                              <span className="text-[8px] font-black text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">OPEN</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
