"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BellRing,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  ExternalLink,
  Flame,
  MapPin,
  Music,
  RefreshCw,
  Sparkles,
  Star,
  Ticket,
  Users,
  Utensils,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/common/Header";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { useCitySelection } from "@/hooks/useCitySelection";
import { LazyImage } from "@/components/common/LazyImage";

import type { LiveEvent } from "@/app/api/events/live/route";
import { useAuth } from "@/components/auth/AuthProvider";
import { SUPPORTED_CITY_NAMES, SupportedCityName } from "@/lib/pune-location";

// ---------- Category config ----------

type EventCategory = LiveEvent["category"] | "all";

const CATEGORIES: { id: EventCategory; label: string; emoji: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All Events", emoji: "✨", icon: <Sparkles size={15} /> },
  { id: "music", label: "Music", emoji: "🎵", icon: <Music size={15} /> },
  { id: "comedy", label: "Comedy", emoji: "😂", icon: <span className="text-sm">😂</span> },
  { id: "food-festival", label: "Food Fest", emoji: "🍽️", icon: <Utensils size={15} /> },
  { id: "workshop", label: "Workshop", emoji: "🎨", icon: <span className="text-sm">🎨</span> },
  { id: "sports", label: "Sports", emoji: "⚽", icon: <span className="text-sm">⚽</span> },
  { id: "cultural", label: "Cultural", emoji: "🎭", icon: <span className="text-sm">🎭</span> },
  { id: "nightlife", label: "Nightlife", emoji: "🌙", icon: <span className="text-sm">🌙</span> },
  { id: "theatre", label: "Theatre", emoji: "🎬", icon: <span className="text-sm">🎬</span> },
  { id: "tech", label: "Tech", emoji: "💻", icon: <Zap size={15} /> },
];

const CATEGORY_GRADIENTS: Record<string, string> = {
  music: "from-violet-600/30 via-purple-600/20 to-transparent border-violet-500/30",
  comedy: "from-yellow-500/30 via-amber-500/20 to-transparent border-yellow-500/30",
  "food-festival": "from-orange-500/30 via-red-500/20 to-transparent border-orange-500/30",
  workshop: "from-teal-500/30 via-cyan-500/20 to-transparent border-teal-500/30",
  sports: "from-green-500/30 via-emerald-500/20 to-transparent border-green-500/30",
  cultural: "from-rose-500/30 via-pink-500/20 to-transparent border-rose-500/30",
  nightlife: "from-indigo-600/30 via-blue-600/20 to-transparent border-indigo-500/30",
  theatre: "from-red-600/30 via-rose-600/20 to-transparent border-red-500/30",
  tech: "from-cyan-500/30 via-blue-500/20 to-transparent border-cyan-500/30",
};

const CATEGORY_BADGE: Record<string, string> = {
  music: "bg-violet-500/20 text-violet-200 border-violet-500/30",
  comedy: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30",
  "food-festival": "bg-orange-500/20 text-orange-200 border-orange-500/30",
  workshop: "bg-teal-500/20 text-teal-200 border-teal-500/30",
  sports: "bg-green-500/20 text-green-200 border-green-500/30",
  cultural: "bg-rose-500/20 text-rose-200 border-rose-500/30",
  nightlife: "bg-indigo-500/20 text-indigo-200 border-indigo-500/30",
  theatre: "bg-red-500/20 text-red-200 border-red-500/30",
  tech: "bg-cyan-500/20 text-cyan-200 border-cyan-500/30",
};

// ---------- Date filter ----------

type DateFilter = "all" | "today" | "tomorrow" | "weekend" | "this-week";

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: "all", label: "All Dates" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "This Weekend" },
  { id: "this-week", label: "This Week" },
];

function isToday(dateStr: string) {
  const today = new Date();
  const d = new Date(dateStr);
  return d.toDateString() === today.toDateString();
}
function isTomorrow(dateStr: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return new Date(dateStr).toDateString() === tomorrow.toDateString();
}
function isThisWeekend(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}
function isThisWeek(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= 7;
}

function matchesDateFilter(event: LiveEvent, filter: DateFilter): boolean {
  if (filter === "all") return true;
  if (filter === "today") return isToday(event.date);
  if (filter === "tomorrow") return isTomorrow(event.date);
  if (filter === "weekend") return isThisWeekend(event.date);
  if (filter === "this-week") return isThisWeek(event.date);
  return true;
}

// ---------- Helpers ----------

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(dateStr)) return "Today";
  if (isTomorrow(dateStr)) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatPrice(price: LiveEvent["price"]): string {
  if (price.isFree) return "Free";
  if (price.min === price.max) return `₹${price.min.toLocaleString("en-IN")}`;
  return `₹${price.min.toLocaleString("en-IN")} – ₹${price.max.toLocaleString("en-IN")}`;
}

function getCategoryEmoji(cat: string): string {
  return CATEGORIES.find((c) => c.id === cat)?.emoji ?? "🎪";
}

function getBookMyShowRegion(city: string, locality: string): string {
  const normCity = city.toLowerCase();
  const normLoc = locality.toLowerCase();

  if (normCity === "mumbai") {
    if (normLoc.includes("thane")) return "thane";
    if (normLoc.includes("navi mumbai") || normLoc.includes("vashi") || normLoc.includes("belapur")) return "navi-mumbai";
    return "mumbai";
  }
  if (normCity === "bangalore" || normCity === "bengaluru") {
    return "bengaluru";
  }
  if (normCity === "delhi") {
    return "ncr";
  }
  return normCity;
}

function buildBookMyShowUrl(event: LiveEvent): string {
  if (event.bookingUrl && event.bookingUrl.includes("bookmyshow")) return event.bookingUrl;
  const region = getBookMyShowRegion(event.city, event.locality);
  return `https://in.bookmyshow.com/explore/events-${region}`;
}

function formatEventLocation(event: LiveEvent): string {
  const parts = [event.venue, event.locality, event.city]
    .map((part) => part?.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return Array.from(new Set(parts)).join(", ");
}

// ---------- Hero card (large featured event) ----------

function HeroEventCard({
  event,
  onBookClick,
  onNotifyClick,
  reminderSaved,
  reminderLoading,
}: {
  event: LiveEvent;
  onBookClick: (event: LiveEvent) => void;
  onNotifyClick: (event: LiveEvent) => void;
  reminderSaved: boolean;
  reminderLoading: boolean;
}) {
  const gradient = CATEGORY_GRADIENTS[event.category] ?? "from-teal-600/30 to-transparent border-teal-500/30";
  const location = formatEventLocation(event);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${gradient} backdrop-blur-sm mb-6 group cursor-pointer shadow-2xl`}
      onClick={() => onBookClick(event)}
    >
      <div className="absolute inset-0 z-0">
        <LazyImage
          src={event.image}
          alt={event.title}
          className="opacity-20 scale-105 transition-transform duration-700 group-hover:scale-110 blur-[1px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--panel-strong)] via-[var(--panel-strong)]/60 to-transparent" />
      </div>

      <div className="relative z-10 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row gap-6 items-start md:items-end min-h-[280px] md:min-h-[340px]">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
              <Flame size={10} /> Trending Tonight
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${CATEGORY_BADGE[event.category] ?? "bg-white/10 text-white border-white/20"}`}>
              {getCategoryEmoji(event.category)} {event.category.replace("-", " ")}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight text-[var(--foreground)] tracking-tight">
            {event.title}
          </h2>

          {event.artists && event.artists.length > 0 && (
            <p className="text-sm font-semibold text-[var(--muted-strong)]">
              {event.artists.join(" · ")}
            </p>
          )}

          <p className="text-xs sm:text-sm text-[var(--muted-strong)] font-medium leading-relaxed line-clamp-2">
            {event.description}
          </p>

          <div className="flex flex-wrap gap-3 text-xs font-bold text-[var(--muted-strong)]">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={13} className="text-teal-400" />
              {formatEventDate(event.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-cyan-400" />
              {formatTime(event.time)}
            </span>
            <span className="flex items-start gap-1.5">
              <MapPin size={13} className="mt-0.5 shrink-0 text-rose-400" />
              <span className="line-clamp-2">{location}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-row md:flex-col gap-2 shrink-0">
          <div className="rounded-xl bg-[var(--panel-soft)] border border-[var(--border)] px-4 py-3 text-center min-w-[120px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Price</p>
            <p className="mt-0.5 text-base font-black text-[var(--foreground)]">{formatPrice(event.price)}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNotifyClick(event);
            }}
            disabled={reminderLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-5 py-3 text-sm font-black text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:opacity-60"
          >
            {reminderSaved ? <CheckCircle size={16} className="text-emerald-300" /> : <BellRing size={16} className="text-amber-300" />}
            {reminderLoading ? "Saving..." : reminderSaved ? "Reminder Set" : "Notify Me"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBookClick(event);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-500/20 transition hover:scale-[1.02] hover:shadow-teal-500/30"
          >
            <Ticket size={16} />
            Book Tickets
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ---------- Event card ----------

function EventCard({
  event,
  index,
  onBookClick,
  onNotifyClick,
  reminderSaved,
  reminderLoading,
}: {
  event: LiveEvent;
  index: number;
  onBookClick: (event: LiveEvent) => void;
  onNotifyClick: (event: LiveEvent) => void;
  reminderSaved: boolean;
  reminderLoading: boolean;
}) {
  const gradient = CATEGORY_GRADIENTS[event.category] ?? "";
  const badge = CATEGORY_BADGE[event.category] ?? "bg-white/10 text-white border-white/20";
  const location = formatEventLocation(event);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] hover:border-[var(--muted)] transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden shrink-0">
        <LazyImage
          src={event.image}
          alt={event.title}
          className="transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--panel)] via-transparent to-transparent" />

        {event.isTrending && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow">
            <Flame size={9} /> Hot
          </span>
        )}

        <span className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm ${badge}`}>
          {getCategoryEmoji(event.category)} {event.category.replace("-", " ")}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-black leading-snug text-[var(--foreground)] line-clamp-2 group-hover:text-teal-300 transition-colors">
            {event.title}
          </h3>
          {event.artists && event.artists.length > 0 && (
            <p className="mt-0.5 text-xs font-semibold text-[var(--muted-strong)] truncate">
              {event.artists.join(" · ")}
            </p>
          )}
        </div>

        <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-2">{event.description}</p>

        <div className="mt-auto space-y-2 text-xs font-semibold text-[var(--muted-strong)]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={12} className="text-teal-400" />
              {formatEventDate(event.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="text-cyan-400" />
              {formatTime(event.time)}
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <MapPin size={12} className="mt-0.5 shrink-0 text-rose-400" />
            <span className="line-clamp-2">{location}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <span className="text-amber-200 font-bold">{event.rating}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users size={11} className="text-[var(--muted)]" />
              <span className="text-[var(--muted)]">Popular</span>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 mt-1">
          <div>
            {event.price.isFree ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-300 border border-emerald-500/30">
                Free Entry
              </span>
            ) : (
              <span className="text-sm font-black text-[var(--foreground)]">{formatPrice(event.price)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onNotifyClick(event)}
              disabled={reminderLoading}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:opacity-60"
              aria-label={reminderSaved ? "Reminder saved" : "Notify me about this event"}
              title={reminderSaved ? "Reminder saved" : "Notify me"}
            >
              {reminderSaved ? <CheckCircle size={14} className="text-emerald-300" /> : <BellRing size={14} className="text-amber-300" />}
            </button>
            <button
              type="button"
              onClick={() => onBookClick(event)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-3 py-1.5 text-xs font-black text-white transition hover:scale-105 hover:shadow-md hover:shadow-teal-500/20"
            >
              <Ticket size={12} />
              Book
              <ExternalLink size={10} />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

// ---------- Skeleton ----------

function EventSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden"
    >
      <div className="h-44 bg-[var(--panel-soft)] animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 rounded bg-[var(--panel-soft)] animate-pulse w-3/4" />
        <div className="h-3 rounded bg-[var(--panel-soft)] animate-pulse w-1/2" />
        <div className="h-3 rounded bg-[var(--panel-soft)] animate-pulse w-full" />
        <div className="h-3 rounded bg-[var(--panel-soft)] animate-pulse w-4/5" />
        <div className="flex gap-2 pt-2">
          <div className="h-7 rounded bg-[var(--panel-soft)] animate-pulse flex-1" />
          <div className="h-7 w-20 rounded bg-[var(--panel-soft)] animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

// ---------- Main Page ----------

export default function EventsPage() {
  const { selectedCity, chooseCity } = useCitySelection();
  const router = useRouter();
  const { user, setAuthRequiredMessage } = useAuth();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState<EventCategory>("all");
  const [activeDateFilter, setActiveDateFilter] = useState<DateFilter>("all");
  const [activeDistrict, setActiveDistrict] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [reminderIds, setReminderIds] = useState<Set<string>>(() => new Set());
  const [reminderLoadingId, setReminderLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const districts = useMemo(() => {
    const list = Array.from(new Set(events.map((e) => e.locality))).filter(Boolean);
    return list.sort();
  }, [events]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cityFromUrl = new URLSearchParams(window.location.search).get("city");
    if (
      cityFromUrl &&
      SUPPORTED_CITY_NAMES.includes(cityFromUrl as SupportedCityName) &&
      cityFromUrl !== selectedCity
    ) {
      chooseCity(cityFromUrl as SupportedCityName);
    }
  }, [chooseCity, selectedCity]);

  const fetchEvents = useCallback(async (city: string, refresh = false) => {
    setLoading(true);
    setEvents([]); // Clear stale events on city change
    setError("");
    try {
      const params = new URLSearchParams({ city, category: "all", ...(refresh ? { refresh: "true" } : {}) });
      const res = await fetch(`/api/events/live?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load events (${res.status})`);
      const data = await res.json();
      setEvents(data.events ?? []);
      setGeneratedAt(data.generatedAt ?? null);
    } catch (err: any) {
      setError(err.message ?? "Failed to load events");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(selectedCity);
  }, [selectedCity, fetchEvents]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEvents(selectedCity, true);
  };

  const handleNotify = async (event: LiveEvent) => {
    if (!user) {
      setAuthRequiredMessage("Log in to save event reminders and see them in your notifications.");
      router.push("/profile");
      return;
    }

    if (reminderIds.has(event.id)) {
      setNotice(`Reminder already set for ${event.title}.`);
      return;
    }

    setReminderLoadingId(event.id);
    setNotice("");
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "event_reminder",
          title: `Reminder: ${event.title}`,
          message: `${formatEventDate(event.date)} at ${formatTime(event.time)} - ${formatEventLocation(event)}.`,
          link: `/events?city=${encodeURIComponent(event.city)}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save reminder.");

      setReminderIds((current) => new Set(current).add(event.id));
      setNotice(`Reminder saved for ${event.title}. Check the bell for updates.`);
    } catch (err: any) {
      setNotice(err.message ?? "Unable to save reminder.");
    } finally {
      setReminderLoadingId(null);
    }
  };

  const filtered = useMemo(() => {
    let result = events;
    if (activeCategory !== "all") result = result.filter((e) => e.category === activeCategory);
    result = result.filter((e) => matchesDateFilter(e, activeDateFilter));
    if (activeDistrict !== "all") result = result.filter((e) => e.locality === activeDistrict);
    return result;
  }, [events, activeCategory, activeDateFilter, activeDistrict]);

  const heroEvent = filtered.find((e) => e.isTrending) ?? filtered[0] ?? null;
  const restEvents = heroEvent ? filtered.filter((e) => e.id !== heroEvent.id) : filtered;

  const todayCount = events.filter((e) => isToday(e.date)).length;
  const thisWeekendCount = events.filter((e) => isThisWeekend(e.date)).length;
  const freeCount = events.filter((e) => e.price.isFree).length;

  return (
    <div className="min-h-screen">
      <Header
        eyebrow="Live Events"
        title="What's Happening"
        location={`${selectedCity} · AI-Powered Feed`}
        showLocation
      />

      <div className="mx-auto max-w-screen-xl px-3 py-4 sm:px-4 md:px-6 md:py-6">
        {/* City switcher + controls */}
        <div className="app-surface rounded-lg p-3 md:p-4 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="w-full sm:w-auto">
                <CitySwitcher
                  value={selectedCity}
                  onChange={(city) => {
                    chooseCity(city);
                    setActiveCategory("all");
                    setActiveDateFilter("all");
                    setActiveDistrict("all");
                  }}
                />
              </div>
              {districts.length > 0 && (
                <div className="w-full sm:w-auto min-w-[200px]">
                  <label className="relative mb-3 block w-full" aria-label="Choose district">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rose-400" size={17} />
                    <select
                      value={activeDistrict}
                      onChange={(event) => setActiveDistrict(event.target.value)}
                      className="h-12 w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--input)] pl-10 pr-10 text-sm font-black text-[var(--foreground)] outline-none transition focus:border-teal-300"
                    >
                      <option value="all">All Districts / Areas</option>
                      {districts.map((dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                  </label>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2.5 text-sm font-black text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:opacity-50 mb-3"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Generating..." : "Refresh Feed"}
            </button>
          </div>

          {generatedAt && (
            <p className="mt-2 text-[10px] text-[var(--muted)] font-semibold">
              <Sparkles size={9} className="inline mr-1 text-teal-400" />
              AI-generated events for {selectedCity} · Updated {new Date(generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Stats pills */}
        {!loading && events.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { label: "Total Events", value: events.length, color: "bg-teal-500/10 text-teal-200 border-teal-500/20" },
              { label: "Today", value: todayCount, color: "bg-rose-500/10 text-rose-200 border-rose-500/20" },
              { label: "This Weekend", value: thisWeekendCount, color: "bg-violet-500/10 text-violet-200 border-violet-500/20" },
              { label: "Free Entry", value: freeCount, color: "bg-emerald-500/10 text-emerald-200 border-emerald-500/20" },
            ].map((stat) => (
              <span key={stat.label} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${stat.color}`}>
                <span className="font-black text-sm">{stat.value}</span>
                {stat.label}
              </span>
            ))}
          </div>
        )}

        {/* Category filter */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 mb-3">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const count = cat.id === "all" ? events.length : events.filter((e) => e.category === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black transition ${
                  isActive
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
                }`}
              >
                {cat.emoji} {cat.label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${isActive ? "bg-white/20" : "bg-[var(--border)]"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Date filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
          {DATE_FILTERS.map((df) => (
            <button
              key={df.id}
              type="button"
              onClick={() => setActiveDateFilter(df.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeDateFilter === df.id
                  ? "bg-[var(--panel)] border border-[var(--muted)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--muted-strong)]"
              }`}
            >
              {df.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
            ⚠️ {error}
          </div>
        )}

        {notice && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-teal-300/20 bg-teal-300/10 px-4 py-3 text-sm font-semibold text-teal-100">
            <BellRing size={16} className="mt-0.5 shrink-0 text-teal-200" />
            <span>{notice}</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <>
            {/* Hero skeleton */}
            <div className="mb-6 h-[280px] rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <EventSkeleton key={i} index={i} />)}
            </div>
          </>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-4 py-20 text-center"
          >
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--panel-soft)] text-3xl">
              🎭
            </div>
            <div>
              <p className="text-lg font-black text-[var(--foreground)]">No events found</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Try a different filter or refresh the feed</p>
            </div>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-black text-[var(--primary-foreground)]"
            >
              <RefreshCw size={15} />
              Generate New Events
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={`${selectedCity}-${activeCategory}-${activeDateFilter}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Hero event */}
              {heroEvent && (
                <HeroEventCard
                  event={heroEvent}
                  onBookClick={(event) => window.open(buildBookMyShowUrl(event), "_blank")}
                  onNotifyClick={handleNotify}
                  reminderSaved={reminderIds.has(heroEvent.id)}
                  reminderLoading={reminderLoadingId === heroEvent.id}
                />
              )}

              {/* Results count */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-[var(--muted)]">
                  <span className="font-black text-[var(--foreground)]">{filtered.length}</span> events in {selectedCity}
                  {activeCategory !== "all" && ` · ${CATEGORIES.find((c) => c.id === activeCategory)?.label}`}
                  {activeDateFilter !== "all" && ` · ${DATE_FILTERS.find((d) => d.id === activeDateFilter)?.label}`}
                </p>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {restEvents.map((event, i) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    index={i}
                    onBookClick={(evt) => window.open(buildBookMyShowUrl(evt), "_blank")}
                    onNotifyClick={handleNotify}
                    reminderSaved={reminderIds.has(event.id)}
                    reminderLoading={reminderLoadingId === event.id}
                  />
                ))}
              </div>

              {/* Footer CTA */}
              {filtered.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-10 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-teal-600/10 via-cyan-600/5 to-transparent p-6 text-center"
                >
                  <p className="text-xs font-black uppercase tracking-widest text-teal-300 mb-2">
                    <Sparkles size={11} className="inline mr-1" />
                    Powered by Sheher AI
                  </p>
                  <h3 className="text-lg font-black text-[var(--foreground)] mb-1">
                    Want more events in {selectedCity}?
                  </h3>
                  <p className="text-sm text-[var(--muted)] mb-4">
                    Our AI generates a fresh events feed. Hit refresh to discover new happenings.
                  </p>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-teal-500/20 transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Generating fresh events..." : "Discover More Events"}
                  </button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
