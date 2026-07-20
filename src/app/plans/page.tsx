"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  CloudSun,
  Compass,
  Heart,
  IndianRupee,
  Map,
  MapPin,
  RefreshCw,
  Route,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { Header } from "@/components/common/Header";
import { LazyImage } from "@/components/common/LazyImage";
import { getPlacesWithDistance } from "@/data/mock-places";
import { useCitySelection } from "@/hooks/useCitySelection";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { getFallbackPlacesForCity } from "@/lib/client/fallback-places";
import { getCategoryLabel } from "@/lib/utils";
import { getCityWeather, useCityLiveWeather } from "@/lib/weather";
import { CITY_CENTERS } from "@/lib/pune-location";
import type { LiveEvent } from "@/app/api/events/live/route";
import type { Place, SupportedCityName } from "@/types";

type PlanMood = "now" | "weekend" | "budget" | "saved";

interface Plan {
  id: string;
  title: string;
  description: string;
  mood: PlanMood;
  duration: string;
  budget: string;
  spendEstimate: string;
  bestFor: string;
  stops: Place[];
  event?: LiveEvent;
  reason: string;
}

const moodStyles: Record<PlanMood, string> = {
  now: "border-teal-300/30 bg-teal-300/10 text-teal-100",
  weekend: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  budget: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  saved: "border-amber-300/30 bg-amber-300/10 text-amber-100",
};

const planIcons: Record<PlanMood, React.ReactNode> = {
  now: <CloudSun size={15} />,
  weekend: <CalendarDays size={15} />,
  budget: <IndianRupee size={15} />,
  saved: <Heart size={15} />,
};

const pickFirst = (places: Place[], predicate: (place: Place) => boolean, used: Set<string>) =>
  places.find((place) => !used.has(place.id) && predicate(place));

const compactStops = (stops: Array<Place | undefined>) => {
  const seen = new Set<string>();
  return stops.filter((stop): stop is Place => {
    if (!stop || seen.has(stop.id)) return false;
    seen.add(stop.id);
    return true;
  });
};

const buildPlanUrl = (plan: Plan) => {
  const stops = plan.stops.map((stop) => stop.id).join(",");
  const params = new URLSearchParams({
    stops,
    sourceName: plan.stops[0]?.title ?? "Start",
    destName: plan.stops[plan.stops.length - 1]?.title ?? "Finish",
    trailName: plan.title,
  });
  return `/map?${params.toString()}`;
};

const buildDiscoverUrl = (place: Place) => `/discover?place=${encodeURIComponent(place.id)}`;

const formatEventDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

const formatEventTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

const getPlanQualityScore = (place: Place, savedPlaceIds: Set<string>) => {
  let score = place.rating * 12 + Math.min(place.reviewCount / 80, 12);
  if (place.isTrending) score += 18;
  if (place.isOpen) score += 8;
  if (savedPlaceIds.has(place.id)) score += 20;
  if (place.distance < 4) score += 8;
  return score;
};

const isBudgetFriendlyPlace = (place: Place) =>
  ["street-food", "food-stall", "cafe", "dessert", "ice-cream"].includes(place.category) ||
  place.tags.some((tag) => ["walk", "heritage", "park", "budget", "student"].includes(tag));

const estimateSpend = (stops: Place[]) => {
  const total = stops.reduce((sum, place) => {
    if (["street-food", "food-stall"].includes(place.category)) return sum + 90;
    if (["dessert", "ice-cream"].includes(place.category)) return sum + 120;
    if (place.category === "cafe") return sum + 180;
    if (place.category === "event" || place.tags.some((tag) => ["walk", "heritage", "park"].includes(tag))) return sum + 40;
    return sum + 260;
  }, 0);

  const rounded = Math.max(150, Math.ceil(total / 50) * 50);
  return `Around Rs ${rounded}`;
};

const makePlans = (
  city: SupportedCityName,
  places: Place[],
  events: LiveEvent[],
  savedPlaces: Place[],
  savedPlaceIds: Set<string>,
  now: Date
): Plan[] => {
  const ranked = [...places]
    .filter((place) => place.city.toLowerCase() === city.toLowerCase())
    .sort((a, b) => getPlanQualityScore(b, savedPlaceIds) - getPlanQualityScore(a, savedPlaceIds));

  const open = ranked.filter((place) => place.isOpen);
  const used = new Set<string>();
  const currentHour = now.getHours();
  const isEvening = currentHour >= 17;

  const cafe = pickFirst(open, (place) => place.category === "cafe", used) ?? ranked.find((place) => place.category === "cafe");
  if (cafe) used.add(cafe.id);
  const food = pickFirst(
    open,
    (place) => ["restaurant", "street-food", "food-stall"].includes(place.category),
    used
  );
  if (food) used.add(food.id);
  const sweet = pickFirst(open, (place) => ["dessert", "ice-cream"].includes(place.category), used);
  if (sweet) used.add(sweet.id);
  const social = pickFirst(
    open,
    (place) => ["nightlife", "bar", "event"].includes(place.category) || place.tags.some((tag) => ["hangout", "music", "live"].includes(tag)),
    used
  );
  if (social) used.add(social.id);

  const todayOrWeekendEvent = [...events]
    .filter((event) => event.city.toLowerCase() === city.toLowerCase())
    .sort((a, b) => Number(b.isTrending) - Number(a.isTrending) || b.rating - a.rating)[0];

  const budgetStops = compactStops([
    ...ranked.filter(isBudgetFriendlyPlace).slice(0, 5),
  ]).slice(0, 4);

  const savedInCity = savedPlaces.filter((place) => place.city.toLowerCase() === city.toLowerCase());
  const savedSeed = savedInCity[0];
  const savedRemix = savedSeed
    ? compactStops([
        savedSeed,
        pickFirst(ranked, (place) => place.locality === savedSeed.locality && place.id !== savedSeed.id, new Set([savedSeed.id])),
        pickFirst(ranked, (place) => place.category !== savedSeed.category && place.id !== savedSeed.id, new Set([savedSeed.id])),
      ])
    : [];

  const plans = [
    {
      id: "budget-run",
      title: "Low-Cost City Run",
      description: "A mapped outing built around street food, quick bites, walkable stops, and low spend.",
      mood: "budget" as const,
      duration: "2-3 hours",
      budget: "Low spend",
      spendEstimate: estimateSpend(budgetStops),
      bestFor: "Students",
      stops: budgetStops,
      reason: "Prioritizes affordable categories first, then keeps the route short enough to avoid extra travel spend.",
    },
    {
      id: "right-now",
      title: isEvening ? "Tonight, Sorted" : "Go Now Mini Plan",
      description: isEvening
        ? "A simple evening route with food, a social stop, and a sweet finish."
        : "A low-friction plan for getting out without overthinking it.",
      mood: "now" as const,
      duration: isEvening ? "3-4 hours" : "90-150 min",
      budget: "Moderate",
      spendEstimate: "Around Rs 600",
      bestFor: isEvening ? "After work" : "Today",
      stops: compactStops(isEvening ? [food, social, sweet] : [cafe, food, sweet]).slice(0, 3),
      event: isEvening ? todayOrWeekendEvent : undefined,
      reason: "Built from open, high-rated places near the city center.",
    },
    {
      id: "weekend-main",
      title: "Weekend No-Brainer",
      description: "A balanced plan with one anchor meal, one discovery stop, and an optional event.",
      mood: "weekend" as const,
      duration: "Half day",
      budget: "Flexible",
      spendEstimate: "Around Rs 900",
      bestFor: "Friends or date",
      stops: compactStops([cafe, food, social, sweet]).slice(0, 4),
      event: todayOrWeekendEvent,
      reason: "Good when you want the app to make the decision for you.",
    },
    {
      id: "saved-remix",
      title: "Saved Places Remix",
      description: "Starts from something you already liked, then adds nearby variety.",
      mood: "saved" as const,
      duration: "2-4 hours",
      budget: "Your style",
      spendEstimate: savedRemix.length > 0 ? estimateSpend(savedRemix) : "Your saved picks",
      bestFor: "Personal pick",
      stops: savedRemix,
      reason: "Uses your saved places when available.",
    },
  ];

  return plans.filter((plan) => plan.stops.length >= 2);
};

export default function PlansPage() {
  const { selectedCity, chooseCity } = useCitySelection();
  const { savedPlaceIds, savedPlaces } = useSavedPlaces();
  const [places, setPlaces] = useState<Place[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    getFallbackPlacesForCity(selectedCity).then((cityPlaces) => {
      if (!cancelled) {
        setPlaces(getPlacesWithDistance(cityPlaces, CITY_CENTERS[selectedCity]));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCity]);

  useEffect(() => {
    const controller = new AbortController();
    setEventsLoading(true);
    fetch(`/api/events/live?city=${encodeURIComponent(selectedCity)}&category=all`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) setEvents(data.events ?? []);
      })
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));

    return () => controller.abort();
  }, [selectedCity, refreshKey]);

  const weather = useCityLiveWeather(selectedCity);
  const plans = useMemo(
    () => makePlans(selectedCity, places, events, savedPlaces, savedPlaceIds, now),
    [events, now, places, savedPlaceIds, savedPlaces, selectedCity]
  );
  const featurePlan = plans[0];

  const refreshPlans = () => {
    setNow(new Date());
    setRefreshKey((key) => key + 1);
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <Header
        eyebrow="Low-Cost City Runs"
        title="Go Out Without Overspending"
        subtitle="Affordable city routes built from street food, quick bites, walkable stops, weather, events, and saved places."
        location={`${selectedCity} - ${weather.label}`}
        showLocation
        className="md:!static md:!top-auto"
      />

      <main className="mx-auto w-full max-w-screen-xl px-3 py-4 sm:px-4 md:px-6 md:py-6">
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-stretch">
          <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
            <div className="relative min-h-[340px]">
              {featurePlan?.stops[0] && (
                <LazyImage
                  src={featurePlan.stops[0].image}
                  alt={featurePlan.stops[0].title}
                  className="opacity-35"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/70 to-[var(--background)]/25" />
              <div className="relative z-10 flex min-h-[340px] flex-col justify-end p-4 sm:p-6 md:p-8">
                <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-teal-100">
                  <IndianRupee size={13} />
                  Sheher USP
                </div>
                <h2 className="max-w-2xl text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
                  {featurePlan?.title ?? "Plans are loading"}
                </h2>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[var(--muted-strong)] sm:text-base">
                  {featurePlan?.description ?? "Finding good places for your city."}
                </p>
                {featurePlan && (
                  <div className="mt-4 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: "Spend", value: featurePlan.spendEstimate },
                      { label: "Stops", value: `${featurePlan.stops.length} picks` },
                      { label: "Time", value: featurePlan.duration },
                      { label: "Route", value: "Map ready" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-white/10 bg-black/25 p-2.5 backdrop-blur">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/55">{item.label}</p>
                        <p className="mt-1 truncate text-xs font-black text-white sm:text-sm">{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                {featurePlan && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={buildPlanUrl(featurePlan)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-black text-[var(--primary-foreground)] transition hover:opacity-90"
                    >
                      <Map size={17} />
                      Start Low-Cost Run
                    </Link>
                    <button
                      type="button"
                      onClick={refreshPlans}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-sm font-black text-[var(--foreground)] transition hover:bg-[var(--panel)]"
                    >
                      <RefreshCw size={17} className={eventsLoading ? "animate-spin" : ""} />
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 md:p-5">
            <div className="grid gap-3">
              <CitySwitcher value={selectedCity} onChange={chooseCity} />
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Places", value: places.length, icon: <MapPin size={15} /> },
                  { label: "Budget picks", value: places.filter(isBudgetFriendlyPlace).length, icon: <IndianRupee size={15} /> },
                  { label: "Saved used", value: savedPlaces.filter((place) => place.city === selectedCity).length, icon: <Heart size={15} /> },
                  { label: "Weather", value: weather.condition, icon: <CloudSun size={15} /> },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                    <div className="flex items-center gap-2 text-[var(--muted)]">
                      {stat.icon}
                      <span className="text-[10px] font-black uppercase tracking-[0.13em]">{stat.label}</span>
                    </div>
                    <p className="mt-2 truncate text-lg font-black text-[var(--foreground)]">{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Why this can be the USP</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted-strong)]">
                  A user does not need another list of places. They need a cheap, mapped plan they can actually do today.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          {plans.map((plan, index) => (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]"
            >
              <div className="grid gap-0 sm:grid-cols-[180px_1fr]">
                <div className="relative min-h-48 sm:min-h-full">
                  {plan.stops[0] && (
                    <LazyImage src={plan.stops[0].image} alt={plan.stops[0].title} className="transition duration-700 hover:scale-105" />
                  )}
                  <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border bg-black/45 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
                    {planIcons[plan.mood]}
                    {plan.bestFor}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${moodStyles[plan.mood]}`}>
                      {planIcons[plan.mood]}
                      {plan.mood}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted-strong)]">
                      <Clock size={12} />
                      {plan.duration}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted-strong)]">
                      <IndianRupee size={12} />
                      {plan.spendEstimate}
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-black tracking-tight text-[var(--foreground)]">{plan.title}</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[var(--muted)]">{plan.description}</p>

                  {plan.mood === "budget" && (
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-2">
                      {[
                        { label: "No guesswork", value: "Route ready" },
                        { label: "Low spend", value: plan.spendEstimate },
                        { label: "Easy stops", value: `${plan.stops.length} places` },
                      ].map((item) => (
                        <div key={item.label} className="min-w-0 text-center">
                          <p className="truncate text-[10px] font-black text-emerald-50">{item.value}</p>
                          <p className="mt-0.5 truncate text-[8px] font-black uppercase tracking-[0.12em] text-emerald-100/60">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 space-y-2">
                    {plan.stops.map((stop, stopIndex) => (
                      <Link
                        key={stop.id}
                        href={buildDiscoverUrl(stop)}
                        className="group flex min-w-0 items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-2 transition hover:bg-[var(--panel)]"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--background)] text-xs font-black text-[var(--foreground)]">
                          {stopIndex + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-[var(--foreground)]">{stop.title}</p>
                          <p className="truncate text-xs font-semibold text-[var(--muted)]">
                            {getCategoryLabel(stop.category, stop.tags)} - {stop.locality}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 text-xs font-black text-amber-200">
                          <Star size={12} className="fill-amber-300 text-amber-300" />
                          {stop.rating.toFixed(1)}
                        </div>
                        <ChevronRight size={15} className="shrink-0 text-[var(--muted)] transition group-hover:text-[var(--foreground)]" />
                      </Link>
                    ))}
                  </div>

                  {plan.event && (
                    <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3">
                      <div className="flex items-start gap-2">
                        <CalendarDays size={16} className="mt-0.5 shrink-0 text-cyan-200" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-cyan-50">{plan.event.title}</p>
                          <p className="mt-0.5 text-xs font-semibold text-cyan-100/80">
                            {formatEventDate(plan.event.date)} at {formatEventTime(plan.event.time)} - {plan.event.locality}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                    <Link
                      href={buildPlanUrl(plan)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-black text-[var(--primary-foreground)] transition hover:opacity-90 sm:flex-none"
                    >
                      <Route size={16} />
                      Map It
                    </Link>
                    <Link
                      href={`/events?city=${encodeURIComponent(selectedCity)}`}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2.5 text-sm font-black text-[var(--foreground)] transition hover:bg-[var(--panel)] sm:flex-none"
                    >
                      <CalendarDays size={16} />
                      Events
                    </Link>
                  </div>

                  <p className="mt-3 flex items-start gap-2 text-xs font-semibold leading-5 text-[var(--muted)]">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                    {plan.reason}
                  </p>
                </div>
              </div>
            </motion.article>
          ))}
        </section>

        {plans.length === 0 && (
          <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-8 text-center">
            <Compass size={34} className="mx-auto text-[var(--muted)]" />
            <h2 className="mt-3 text-lg font-black text-[var(--foreground)]">No plans for this city yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-[var(--muted)]">
              Try another city or open Discover to browse places directly.
            </p>
          </div>
        )}

        <section className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">Need a different vibe?</p>
              <h2 className="mt-1 text-xl font-black text-[var(--foreground)]">Search the full city instead</h2>
            </div>
            <Link
              href="/discover?focus=true"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-sm font-black text-[var(--foreground)] transition hover:bg-[var(--panel)]"
            >
              <UtensilsCrossed size={17} />
              Find Places
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
