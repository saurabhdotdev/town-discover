"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Coffee,
  Compass,
  Flame,
  LocateFixed,
  Map,
  Search,
  Sparkles,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { DiscoverySection } from "@/components/cards/DiscoverySection";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { getFallbackPlacesForCity, getPlacesWithDistance } from "@/data/mock-places";
import { useLivePlaces } from "@/hooks/useLivePlaces";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { Place, PlaceCategory } from "@/types";
import { formatDistance, getCategoryLabel, isOpenNow } from "@/lib/utils";
import { CITY_CENTERS, getCityFromQuery, stripCityFromQuery, SupportedCityName } from "@/lib/pune-location";

type HomeFilter = "all" | "trending" | "open" | "free" | PlaceCategory;

const filters: { id: HomeFilter; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: <Sparkles size={17} /> },
  { id: "trending", label: "Trending", icon: <Flame size={17} /> },
  { id: "open", label: "Open Now", icon: <LocateFixed size={17} /> },
  { id: "cafe", label: "Cafes", icon: <Coffee size={17} /> },
  { id: "restaurant", label: "Food", icon: <UtensilsCrossed size={17} /> },
  { id: "event", label: "Events", icon: <CalendarDays size={17} /> },
];

export default function Home() {
  const [selectedCity, setSelectedCity] = useState<SupportedCityName>("Pune");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<HomeFilter>("all");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [hasChosenCity, setHasChosenCity] = useState(false);
  const { savedPlaceIds, toggleSave } = useSavedPlaces();
  const { location, source: locationSource, city: detectedCity } = useGeolocation();
  const activeCity = getCityFromQuery(query) ?? (!hasChosenCity && locationSource === "browser" ? detectedCity : selectedCity);
  const activeLocation =
    locationSource === "browser" && location && activeCity === detectedCity ? location : CITY_CENTERS[activeCity];
  const liveQuery = query.trim() || activeCity;
  const { places: livePlaces, loading: livePlacesLoading, error: livePlacesError } = useLivePlaces(activeLocation, liveQuery);

  const usingLivePlaces = livePlaces.length > 0;
  const fallbackPlaces = useMemo(() => getFallbackPlacesForCity(activeCity), [activeCity]);
  const allPlaces = useMemo(
    () => getPlacesWithDistance(usingLivePlaces ? livePlaces : fallbackPlaces, activeLocation),
    [activeLocation, fallbackPlaces, livePlaces, usingLivePlaces]
  );
  const featuredPlace = allPlaces.find((place) => place.isTrending) ?? allPlaces[0] ?? null;
  const nearbyPlaces = useMemo(
    () => [...allPlaces].sort((a, b) => a.distance - b.distance).slice(0, 6),
    [allPlaces]
  );

  const normalizedQuery = stripCityFromQuery(query).toLowerCase();
  const inferredFilter =
    /\bcafes?\b/.test(normalizedQuery)
      ? "cafe"
      : /\b(restaurants?|hotels?|food)\b/.test(normalizedQuery)
        ? "restaurant"
        : /\b(bars?|pubs?|nightlife)\b/.test(normalizedQuery)
          ? "bar"
          : /\b(events?|attractions?|things|temples?|museums?)\b/.test(normalizedQuery)
            ? "event"
            : null;
  const effectiveFilter = activeFilter === "all" ? inferredFilter : activeFilter;
  const filteredPlaces = allPlaces.filter((place) => {
    const matchesQuery =
      !normalizedQuery ||
      inferredFilter ||
      [place.title, place.locality, place.city, place.category, place.description, ...place.tags]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    const matchesFilter =
      !effectiveFilter ||
      (effectiveFilter === "trending" && place.isTrending) ||
      (effectiveFilter === "open" && isOpenNow(place.hours)) ||
      (effectiveFilter === "free" && place.tags.includes("free") && place.tags.includes("tourist-friendly")) ||
      place.category === effectiveFilter;

    return matchesQuery && matchesFilter;
  }).slice(0, 9);

  return (
    <div className="min-h-screen">
      <section className="mx-auto grid max-w-screen-xl gap-5 px-3 py-4 sm:px-4 md:min-h-[calc(100vh-5rem)] md:grid-cols-[minmax(0,1fr)_380px] md:px-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        className="flex flex-col justify-center gap-5 pt-10 md:gap-6 md:pt-0"
        >
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-[var(--fresh)]">
              <Compass size={15} />
              {usingLivePlaces ? `Live in ${activeCity}` : `${activeCity} discovery`}
            </span>
            <h1 className="max-w-4xl text-3xl font-black leading-tight tracking-tight text-[var(--foreground)] sm:text-4xl md:text-6xl">
              Find the right place for right now.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted-strong)] sm:text-base md:text-lg md:leading-7">
              Browse cafes, food spots, bars, heritage walks, and weekend plans city by city.
            </p>
          </div>

          <div className="app-surface rounded-lg p-3 md:p-4">
            <CitySwitcher
              value={activeCity}
              onChange={(city) => {
                setHasChosenCity(true);
                setSelectedCity(city);
                setQuery("");
                setActiveFilter("all");
              }}
            />
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={20} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search cafes, food, events in ${activeCity}...`}
                className="h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] pl-11 pr-3 text-sm font-semibold text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-teal-300 sm:h-14 sm:pl-12 sm:pr-4 sm:text-base"
              />
            </label>

            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
              {filters.map((filter) => {
                const active = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition sm:px-4 sm:text-sm ${
                      active
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
                    }`}
                  >
                    {filter.icon}
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: usingLivePlaces ? "Live Places" : "Backup Places", value: allPlaces.length.toString() },
              { label: "City Picks", value: allPlaces.filter((place) => place.isTrending).length.toString() },
              { label: locationSource === "browser" ? "Near You" : "Nearby", value: nearbyPlaces.length.toString() },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3 sm:p-4">
                <p className="text-xl font-black text-[var(--foreground)] sm:text-2xl">{stat.value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] sm:text-xs sm:tracking-[0.14em]">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/discover"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-3 font-black text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              Open Discover
              <Compass size={18} />
            </Link>
            <Link
              href="/map"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-5 py-3 font-black text-[var(--foreground)] transition hover:bg-[var(--panel)]"
            >
              View Map
              <Map size={18} />
            </Link>
          </div>
        </motion.div>

        <motion.aside
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="flex items-center"
        >
          {featuredPlace ? (
            <button
              type="button"
              onClick={() => setSelectedPlace(featuredPlace)}
              className="group relative min-h-[320px] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)] text-left shadow-2xl sm:min-h-[430px] md:min-h-[560px]"
            >
            <Image
              src={featuredPlace.image}
              alt={`${featuredPlace.title} in ${featuredPlace.locality}`}
              fill
              sizes="(max-width: 768px) 100vw, 380px"
              priority
              className="transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080b0f] via-[#080b0f]/54 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 space-y-3 p-4 sm:space-y-4 sm:p-5">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
                  Trending
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-950">
                  {getCategoryLabel(featuredPlace.category)}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{featuredPlace.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{featuredPlace.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm font-bold text-white">
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                  <Star size={16} className="fill-yellow-300 text-yellow-300" />
                  {featuredPlace.rating}
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                  <LocateFixed size={16} className="text-cyan-300" />
                  {formatDistance(featuredPlace.distance)}
                </span>
              </div>
            </div>
            </button>
          ) : (
            <div className="grid min-h-[320px] w-full place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center shadow-2xl sm:min-h-[430px] md:min-h-[560px]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">OpenStreetMap</p>
                <h2 className="mt-2 text-2xl font-black text-[var(--foreground)]">Search a city or place</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Try Mumbai, cafes in Nashik, Kolhapur misal, or bars in Pune.
                </p>
              </div>
            </div>
          )}
        </motion.aside>
      </section>

      <section className="mx-auto max-w-screen-xl px-3 pb-12 sm:px-4 md:px-6 md:pb-16">
        <DiscoverySection
          title={query || activeFilter !== "all" ? "Matching Places" : usingLivePlaces ? "Live Nearby" : "Start Here"}
          description={
            usingLivePlaces
              ? `Real OpenStreetMap places loaded for ${activeCity}.`
              : livePlacesError
                ? `Showing curated ${activeCity} backup places while live OpenStreetMap is unavailable.`
                : `Showing curated ${activeCity} backup places.`
          }
          places={filteredPlaces}
          loading={livePlacesLoading && !usingLivePlaces}
          onPlaceClick={setSelectedPlace}
          onSavePlace={toggleSave}
          savedPlaceIds={savedPlaceIds}
        />

        {!query && activeFilter === "all" && (
          <>
            <DiscoverySection
              title="Closest Picks"
              description="Good nearby options when you want to choose fast and go."
              places={nearbyPlaces}
              onPlaceClick={setSelectedPlace}
              onSavePlace={toggleSave}
              savedPlaceIds={savedPlaceIds}
            />
          </>
        )}
      </section>

      <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
    </div>
  );
}
