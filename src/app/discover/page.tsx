"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Coffee,
  Compass,
  LocateFixed,
  MapPin,
  Martini,
  Search,
  Sparkles,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { DiscoverySection } from "@/components/cards/DiscoverySection";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import { MapView } from "@/components/map/MapView";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLivePlaces } from "@/hooks/useLivePlaces";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { getFallbackPlacesForCity, getPlacesWithDistance } from "@/data/mock-places";
import { Place, PlaceCategory } from "@/types";
import { getCategoryLabel, isOpenNow } from "@/lib/utils";
import { CITY_CENTERS, getCityFromQuery, stripCityFromQuery, SupportedCityName } from "@/lib/pune-location";

type CategoryFilter = "all" | "free" | PlaceCategory;
type SortMode = "recommended" | "distance" | "rating";

const categories: { id: CategoryFilter; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: <Sparkles size={17} /> },
  { id: "cafe", label: "Cafes", icon: <Coffee size={17} /> },
  { id: "restaurant", label: "Restaurants", icon: <UtensilsCrossed size={17} /> },
  { id: "event", label: "Events", icon: <CalendarDays size={17} /> },
  { id: "bar", label: "Bars", icon: <Martini size={17} /> },
  { id: "food-stall", label: "Street Food", icon: <Store size={17} /> },
];

export default function DiscoverPage() {
  const { location, loading: locationLoading, error: locationError, source: locationSource, city: detectedCity } = useGeolocation();
  const [selectedCity, setSelectedCity] = useState<SupportedCityName>("Pune");
  const [hasChosenCity, setHasChosenCity] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const { savedPlaceIds, toggleSave } = useSavedPlaces();
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
  const hasFilters = Boolean(query.trim()) || activeCategory !== "all" || openOnly || sortMode !== "recommended";
  const locationLabel = locationLoading
    ? "Finding location"
    : locationSource === "browser" && activeCity === detectedCity
      ? `Near you in ${activeCity}`
    : usingLivePlaces
      ? `Live ${activeCity} places`
      : `${activeCity} backup places`;

  const filteredPlaces = useMemo(() => {
    const normalizedQuery = stripCityFromQuery(query).toLowerCase();
    const inferredCategory =
      /\bcafes?\b/.test(normalizedQuery)
        ? "cafe"
        : /\b(restaurants?|hotels?|food)\b/.test(normalizedQuery)
          ? "restaurant"
          : /\b(bars?|pubs?|nightlife)\b/.test(normalizedQuery)
            ? "bar"
            : /\b(events?|attractions?|things|temples?|museums?)\b/.test(normalizedQuery)
              ? "event"
              : null;
    const effectiveCategory = activeCategory === "all" ? inferredCategory : activeCategory;

    const results = allPlaces.filter((place) => {
      const matchesQuery =
        !normalizedQuery ||
        inferredCategory ||
        [place.title, place.locality, place.city, place.category, place.description, ...place.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesCategory =
        !effectiveCategory ||
        (effectiveCategory === "free" && place.tags.includes("free") && place.tags.includes("tourist-friendly")) ||
        place.category === effectiveCategory;
      const matchesOpen = !openOnly || isOpenNow(place.hours);
      return matchesQuery && matchesCategory && matchesOpen;
    });

    return [...results].sort((a, b) => {
      if (sortMode === "distance") return a.distance - b.distance;
      if (sortMode === "rating") return b.rating - a.rating;
      if (a.isTrending !== b.isTrending) return Number(b.isTrending) - Number(a.isTrending);
      return a.distance - b.distance;
    });
  }, [activeCategory, allPlaces, openOnly, query, sortMode]);

  const defaultSections = [
    {
      title: query.trim() ? "Matching Places" : `${activeCity} Places`,
      description: query.trim()
        ? usingLivePlaces
          ? "Real OpenStreetMap results for your search."
          : `Curated ${activeCity} backup results for your search.`
        : usingLivePlaces
          ? `Real OpenStreetMap results near ${activeCity}.`
          : `Curated ${activeCity} backup results while live data is unavailable.`,
      places: allPlaces.slice(0, 9),
    },
    {
      title: "Closest to You",
      description: "Sorted by distance from the city or location being used.",
      places: [...allPlaces].sort((a, b) => a.distance - b.distance).slice(0, 6),
    },
    {
      title: "Cafes and Desserts",
      description: "Coffee, sweet breaks, and work-friendly corners.",
      places: allPlaces.filter((place) => ["cafe", "dessert"].includes(place.category)).slice(0, 6),
    },
    {
      title: "Events Tonight",
      description: "Attractions, walks, landmarks, and public places from OpenStreetMap.",
      places: allPlaces.filter((place) => place.category === "event").slice(0, 6),
    },
    {
      title: "Nightlife and Bars",
      description: "Late plans, cocktails, and louder rooms.",
      places: allPlaces.filter((place) => ["bar", "nightlife"].includes(place.category)).slice(0, 6),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header
        eyebrow="Discover"
        title="Explore Nearby"
        subtitle="Search, filter, and open details across Pune, Mumbai, Kolhapur, and Nashik."
        location={locationLabel}
        showLocation
      />

      <div className="mx-auto max-w-screen-xl px-3 py-4 sm:px-4 md:px-6 md:py-6">
        <div className="app-surface rounded-lg p-3 md:p-4">
          <CitySwitcher
            value={activeCity}
            onChange={(city) => {
              setHasChosenCity(true);
              setSelectedCity(city);
              setQuery("");
              setActiveCategory("all");
            }}
          />
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={19} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search cafes, food, events in ${activeCity}`}
                className="h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] pl-11 pr-3 text-sm font-semibold text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-teal-300 sm:pr-4"
              />
            </label>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm font-bold text-[var(--foreground)] outline-none transition focus:border-teal-300 lg:w-auto"
              aria-label="Sort places"
            >
              <option value="recommended">Recommended</option>
              <option value="distance">Nearest first</option>
              <option value="rating">Highest rated</option>
            </select>

            <button
              type="button"
              onClick={() => setOpenOnly((current) => !current)}
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition ${
                openOnly
                  ? "bg-emerald-300 text-slate-950"
                  : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
              }`}
            >
              <LocateFixed size={17} />
              Open now
            </button>
          </div>

          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => {
              const active = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition sm:px-4 sm:text-sm ${
                    active
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
                  }`}
                >
                  {category.icon}
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        {locationError && (
          <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
            {locationError}
          </div>
        )}

        {livePlacesError && (
          <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100">
            Showing curated {activeCity} backup places while live OpenStreetMap is unavailable. {livePlacesError}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 md:mt-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5">
              <Compass size={15} className="text-teal-300" />
              {livePlacesLoading
                ? "Loading live nearby places"
                : hasFilters
                  ? `${filteredPlaces.length} matching places`
                  : `${allPlaces.length} ${usingLivePlaces ? "real" : "backup"} ${activeCity} places`}
            </span>
            {activeCategory !== "all" && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5">
                {activeCategory === "free" ? "Free 2-3 hrs" : getCategoryLabel(activeCategory)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowMap((current) => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2.5 text-sm font-black text-[var(--foreground)] transition hover:bg-[var(--panel)]"
          >
            <MapPin size={17} />
            {showMap ? "Hide Map" : "Show Map"}
          </button>
        </div>

        {showMap && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-5"
          >
            <MapView
              places={hasFilters ? filteredPlaces : allPlaces}
              userLocation={activeLocation}
              selectedPlace={selectedPlace}
              onMarkerClick={setSelectedPlace}
              className="h-[320px] min-h-[320px] rounded-lg sm:h-[420px] sm:min-h-[420px]"
            />
          </motion.div>
        )}

        <div className="py-4">
          {hasFilters ? (
            <DiscoverySection
              title="Filtered Results"
              description="Your current search and filters, sorted the way you chose."
              places={filteredPlaces}
              loading={livePlacesLoading}
              onPlaceClick={setSelectedPlace}
              onSavePlace={toggleSave}
              savedPlaceIds={savedPlaceIds}
            />
          ) : (
            defaultSections.map((section) => (
              <DiscoverySection
                key={section.title}
                title={section.title}
                description={section.description}
                places={section.places}
                loading={livePlacesLoading && !usingLivePlaces}
                onPlaceClick={setSelectedPlace}
                onSavePlace={toggleSave}
                savedPlaceIds={savedPlaceIds}
              />
            ))
          )}
        </div>
      </div>

      <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
    </div>
  );
}
