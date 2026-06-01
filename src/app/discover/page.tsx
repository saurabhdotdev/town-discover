"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Car,
  Coffee,
  Compass,
  LocateFixed,
  MapPin,
  Martini,
  Search,
  Sparkles,
  Store,
  UtensilsCrossed,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { LocationPermissionCard } from "@/components/common/LocationPermissionCard";
import { MoodPicker } from "@/components/common/MoodPicker";
import { DiscoverySection } from "@/components/cards/DiscoverySection";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import dynamic from "next/dynamic";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLivePlaces } from "@/hooks/useLivePlaces";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { MOCK_PLACES, getPlacesWithDistance } from "@/data/mock-places";
import { getFallbackPlacesForCity } from "@/lib/client/fallback-places";
import { Place, PlaceCategory } from "@/types";
import { getCategoryLabel } from "@/lib/utils";
import { CITY_CENTERS, getCityFromQuery, stripCityFromQuery } from "@/lib/pune-location";
import { useCitySelection } from "@/hooks/useCitySelection";
import { useMoodSelection } from "@/hooks/useMoodSelection";
import { getMoodLabel, getTopMoodRecommendations } from "@/lib/mood-recommendations";
import { combineLiveAndCuratedPlaces } from "@/lib/combine-places";

const MapView = dynamic(() => import("@/components/map/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] min-h-[320px] rounded-lg bg-[var(--panel-soft)] border border-[var(--border)] animate-pulse flex items-center justify-center text-sm font-semibold text-[var(--muted)]">
      Loading interactive map...
    </div>
  ),
});
import { filterAndRankPlaces } from "@/lib/place-search";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

type CategoryFilter = "all" | "free" | "night-drive" | PlaceCategory;
type SortMode = "recommended" | "distance" | "rating";

const categories: { id: CategoryFilter; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: <Sparkles size={17} /> },
  { id: "night-drive", label: "Night Drives", icon: <Car size={17} /> },
  { id: "cafe", label: "Cafes", icon: <Coffee size={17} /> },
  { id: "restaurant", label: "Restaurants", icon: <UtensilsCrossed size={17} /> },
  { id: "event", label: "Events", icon: <CalendarDays size={17} /> },
  { id: "bar", label: "Bars", icon: <Martini size={17} /> },
  { id: "food-stall", label: "Street Food", icon: <Store size={17} /> },
];

export default function DiscoverPage() {
  const {
    location,
    loading: locationLoading,
    error: locationError,
    source: locationSource,
    city: detectedCity,
    requestLocation,
  } = useGeolocation();
  const { selectedCity, hasChosenCity, chooseCity, preferDetectedCity } = useCitySelection();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const { savedPlaceIds, savedPlaces, toggleSave } = useSavedPlaces();
  const { selectedMood, setSelectedMood } = useMoodSelection();

  // Advanced Filters State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [selectedPrice, setSelectedPrice] = useState<string>("all");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Spotlight Banner State
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  const activeCity = getCityFromQuery(query) ?? (!hasChosenCity && locationSource === "browser" ? detectedCity : selectedCity);
  const queryLocation = CITY_CENTERS[activeCity];
  const distanceReference = locationSource === "browser" && location && activeCity === detectedCity ? location : queryLocation;

  const savedPlacesInCity = useMemo(() => {
    const resolved = savedPlaces.filter((p) => p.city.toLowerCase() === activeCity.toLowerCase());
    return getPlacesWithDistance(resolved, distanceReference);
  }, [savedPlaces, activeCity, distanceReference]);
  const activeLocation = queryLocation;
  const liveQuery = query.trim() || activeCity;
  const { places: livePlaces, loading: livePlacesLoading, error: livePlacesError } = useLivePlaces(activeLocation, liveQuery);

  const usingLivePlaces = livePlaces.length > 0;
  const [curatedPlaces, setCuratedPlaces] = useState<Place[]>([]);
  useEffect(() => {
    let cancelled = false;
    getFallbackPlacesForCity(activeCity).then((places) => {
      if (!cancelled) setCuratedPlaces(places);
    });
    return () => {
      cancelled = true;
    };
  }, [activeCity]);

  const allPlaces = useMemo(
    () =>
      getPlacesWithDistance(combineLiveAndCuratedPlaces(livePlaces, curatedPlaces), distanceReference),
    [distanceReference, curatedPlaces, livePlaces]
  );

  const hasFilters =
    Boolean(query.trim()) ||
    activeCategory !== "all" ||
    openOnly ||
    sortMode !== "recommended" ||
    selectedRating > 0 ||
    selectedPrice !== "all" ||
    selectedTags.size > 0;

  const locationLabel = locationLoading
    ? "Finding location"
    : locationSource === "browser" && activeCity === detectedCity
      ? `Near you in ${activeCity}`
      : usingLivePlaces
        ? `Live + curated ${activeCity}`
        : `Curated ${activeCity} places`;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const normalizedQuery = stripCityFromQuery(debouncedQuery).toLowerCase();

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const filteredPlaces = useMemo(() => {
    let results = filterAndRankPlaces(allPlaces, {
      query: normalizedQuery,
      category: activeCategory,
      openOnly,
      now,
      explicitMood: selectedMood,
      useMoodRanking: selectedMood != null && sortMode === "recommended",
    });

    // Rating Filter
    if (selectedRating > 0) {
      results = results.filter((p) => p.rating >= selectedRating);
    }

    // Price Filter
    if (selectedPrice !== "all") {
      results = results.filter((p) => p.priceRange === selectedPrice);
    }

    // Tags Filter
    if (selectedTags.size > 0) {
      results = results.filter((p) =>
        Array.from(selectedTags).every((tag) => p.tags.includes(tag))
      );
    }

    const sortedResults = [...results].sort((a, b) => {
      if (sortMode === "distance") return a.distance - b.distance;
      if (sortMode === "rating") return b.rating - a.rating;
      if (selectedMood && sortMode === "recommended") return 0;
      if (a.isTrending !== b.isTrending) return Number(b.isTrending) - Number(a.isTrending);
      return a.distance - b.distance;
    });

    const PAGE_SIZE = 20;
    return sortedResults.slice(0, page * PAGE_SIZE);
  }, [activeCategory, allPlaces, normalizedQuery, now, openOnly, selectedMood, sortMode, page, selectedRating, selectedPrice, selectedTags]);

  const totalFilteredCount = useMemo(() => {
    let results = filterAndRankPlaces(allPlaces, {
      query: normalizedQuery,
      category: activeCategory,
      openOnly,
      now,
      explicitMood: selectedMood,
      useMoodRanking: selectedMood != null && sortMode === "recommended",
    });

    if (selectedRating > 0) {
      results = results.filter((p) => p.rating >= selectedRating);
    }
    if (selectedPrice !== "all") {
      results = results.filter((p) => p.priceRange === selectedPrice);
    }
    if (selectedTags.size > 0) {
      results = results.filter((p) =>
        Array.from(selectedTags).every((tag) => p.tags.includes(tag))
      );
    }
    return results.length;
  }, [activeCategory, allPlaces, normalizedQuery, now, openOnly, selectedMood, sortMode, selectedRating, selectedPrice, selectedTags]);

  const handleLoadMore = useCallback(() => setPage((p) => p + 1), []);
  const hasMore = filteredPlaces.length < totalFilteredCount;

  // Pick trending or highest rated spots for the Spotlight Slideshow
  const spotlightSpots = useMemo(() => {
    const trending = allPlaces.filter((p) => p.isTrending);
    if (trending.length > 0) return trending.slice(0, 3);
    return [...allPlaces].sort((a, b) => b.rating - a.rating).slice(0, 3);
  }, [allPlaces]);

  // Spotlight slideshow rotation
  useEffect(() => {
    if (spotlightSpots.length <= 1) return;
    const interval = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % spotlightSpots.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [spotlightSpots.length]);

  const moodPicks = useMemo(() => {
    if (!selectedMood) return [];
    return getTopMoodRecommendations(allPlaces, {
      query: normalizedQuery,
      now,
      explicitMood: selectedMood,
      limit: 12,
    });
  }, [allPlaces, normalizedQuery, now, selectedMood]);

  useEffect(() => {
    const placeId = new URLSearchParams(window.location.search).get("place");
    if (!placeId || selectedPlace?.id === placeId) return;

    const linkedPlace = allPlaces.find((place) => place.id === placeId);
    if (linkedPlace) {
      setTimeout(() => {
        setSelectedPlace(linkedPlace);
      }, 0);
    } else {
      // Resolve the place dynamically if not found in the preloaded list
      fetch(`/api/places/resolve?ids=${encodeURIComponent(placeId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.places && data.places.length > 0) {
            setSelectedPlace(data.places[0]);
          }
        })
        .catch((err) => console.error("Error resolving deep-linked place:", err));
    }
  }, [allPlaces, selectedPlace?.id]);

  const defaultSections = [
    ...(savedPlacesInCity.length > 0
      ? [
        {
          title: `Your Favorites in ${activeCity}`,
          description: `Quick access to your bookmarked spots in ${activeCity}.`,
          places: savedPlacesInCity,
        },
      ]
      : []),
    ...(selectedMood
      ? [
        {
          title: `Picked for your ${getMoodLabel(selectedMood).toLowerCase()} mood`,
          description: `Top ${activeCity} matches for how you're feeling — cafes, events, food, and time-pass plans.`,
          places: moodPicks,
        },
      ]
      : []),
    {
      title: query.trim() ? "Matching Places" : `${activeCity} Places`,
      description: query.trim()
        ? usingLivePlaces
          ? "Real OpenStreetMap results for your search."
          : `Curated ${activeCity} backup results for your search.`
        : usingLivePlaces
          ? `Real OpenStreetMap results near ${activeCity}.`
          : `Curated ${activeCity} backup results while live data is unavailable.`,
      places: allPlaces.slice(0, 12),
    },
    {
      title: "Closest to You",
      description: "Sorted by distance from the city or location being used.",
      places: [...allPlaces].sort((a, b) => a.distance - b.distance).slice(0, 9),
    },
    {
      title: "Family, Pet & Traveler Favorites",
      description: "Highly rated, welcoming spots perfect for international visitors, family outings, and pet companions.",
      places: allPlaces.filter((place) =>
        place.tags.some(tag => ["foreigner-friendly", "family-friendly", "pet-friendly", "heritage", "tourist-friendly", "cultural", "family"].includes(tag))
      ).slice(0, 9),
    },
    {
      title: "Cafes and Desserts",
      description: "Coffee, sweet breaks, and work-friendly corners.",
      places: allPlaces.filter((place) => ["cafe", "dessert"].includes(place.category)).slice(0, 9),
    },
    {
      title: "Events Tonight",
      description: "Attractions, walks, landmarks, workshops, and time-pass plans.",
      places: allPlaces.filter((place) => place.category === "event" && !place.tags.includes("night-drive")).slice(0, 15),
    },
    {
      title: "Scenic Night Drives",
      description: "Late evening cruises, sea bridges, and loop routes mapping out city road vibes.",
      places: allPlaces.filter((place) => place.tags.includes("night-drive")).slice(0, 9),
    },
    {
      title: "Nightlife and Bars",
      description: "Late plans, cocktails, and louder rooms.",
      places: allPlaces.filter((place) => ["bar", "nightlife"].includes(place.category)).slice(0, 9),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header
        eyebrow="Discover"
        title="Explore Nearby"

        location={locationLabel}
        showLocation
      />

      <div className="mx-auto max-w-screen-xl px-3 py-4 sm:px-4 md:px-6 md:py-6">
        {/* Weekly Spotlight Slideshow */}
        {spotlightSpots.length > 0 && !hasFilters && (
          <section className="relative mb-5 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl md:mb-6">
            <div className="absolute inset-0 z-0 h-full w-full">
              <img
                src={spotlightSpots[spotlightIndex].image}
                alt={spotlightSpots[spotlightIndex].title}
                className="h-full w-full object-cover opacity-25 blur-[1px] scale-105 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--spotlight-overlay-from)] via-[var(--spotlight-overlay-via)] to-transparent" />
            </div>

            <div className="relative z-10 flex min-h-[240px] flex-col justify-between gap-5 p-4 sm:p-8 md:min-h-[380px] md:flex-row md:items-end md:p-12">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-teal-400 text-slate-950 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.15em]">
                    ★ Spotlight
                  </span>
                  <span className="inline-flex rounded-full bg-[var(--panel-soft)] text-[var(--fresh)] px-3 py-0.5 text-[10px] font-black uppercase border border-[var(--border)]">
                    {spotlightSpots[spotlightIndex].category}
                  </span>
                  <span className="inline-flex rounded-full bg-amber-500/10 text-amber-500 px-2 py-0.5 text-[10px] font-bold border border-amber-500/20">
                    ★ {spotlightSpots[spotlightIndex].rating}
                  </span>
                </div>

                <h3 className="text-2xl font-black leading-tight text-[var(--foreground)] sm:text-3xl md:text-4xl">
                  {spotlightSpots[spotlightIndex].title}
                </h3>
                <p className="text-[var(--muted-strong)] text-xs sm:text-sm font-semibold leading-relaxed line-clamp-3">
                  {spotlightSpots[spotlightIndex].description}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {spotlightSpots[spotlightIndex].tags.slice(0, 3).map((t) => (
                    <span key={t} className="text-[10px] bg-[var(--panel-soft)] border border-[var(--border)] text-[var(--muted)] px-2.5 py-0.5 rounded-full font-bold">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <button
                  onClick={() => setSelectedPlace(spotlightSpots[spotlightIndex])}
                  className="w-full rounded-lg bg-teal-500 px-5 py-3 text-xs font-black text-white shadow-lg shadow-teal-500/10 transition hover:bg-teal-400 sm:w-auto"
                >
                  Explore Details
                </button>
              </div>
            </div>

            {/* Slide Indicators */}
            {spotlightSpots.length > 1 && (
              <div className="absolute bottom-4 left-6 sm:left-8 md:left-12 flex items-center gap-1.5 z-20">
                {spotlightSpots.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSpotlightIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${spotlightIndex === idx ? "w-6 bg-teal-500" : "w-1.5 bg-[var(--border)] hover:bg-[var(--muted)]"
                      }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <div className="app-surface rounded-lg p-3 md:p-4">
          <CitySwitcher
            value={activeCity}
            onChange={(city) => {
              chooseCity(city);
              setQuery("");
              setActiveCategory("all");
            }}
          />
          <LocationPermissionCard
            source={locationSource}
            loading={locationLoading}
            error={locationError}
            onRequest={() => {
              preferDetectedCity();
              requestLocation();
            }}
          />
          <MoodPicker value={selectedMood} onChange={setSelectedMood} className="mt-3" />

          {/* Search controls — mobile 2-row, desktop single-row */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {/* Search bar */}
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={19} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search cafes, food, events in ${activeCity}`}
                className="h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] pl-11 pr-3 text-sm font-semibold text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-teal-300"
              />
            </label>

            {/* Controls — row on mobile too, but smaller */}
            <div className="flex items-center gap-2">
              {/* Sort Dropdown */}
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-10 flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-xs font-bold text-[var(--foreground)] outline-none transition focus:border-teal-300 sm:h-12 sm:flex-initial sm:w-auto sm:px-3 sm:text-sm"
                aria-label="Sort places"
              >
                <option value="recommended">Recommended</option>
                <option value="distance">Nearest</option>
                <option value="rating">Top rated</option>
              </select>

              {/* Open Now Button */}
              <button
                type="button"
                onClick={() => setOpenOnly((current) => !current)}
                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition whitespace-nowrap sm:h-12 sm:gap-2 sm:px-4 sm:text-sm ${openOnly
                    ? "bg-emerald-300 text-slate-950"
                    : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
                  }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full hidden sm:block ${openOnly ? "bg-slate-950 animate-pulse" : "bg-slate-500"}`} />
                <span className="sm:hidden"><LocateFixed size={15} /></span>
                <span className="hidden sm:inline">Open now</span>
                <span className="sm:hidden">Open</span>
              </button>

              {/* Advanced Filters Button */}
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition whitespace-nowrap sm:h-12 sm:gap-2 sm:px-4 sm:text-sm ${showAdvancedFilters || selectedRating > 0 || selectedPrice !== "all" || selectedTags.size > 0
                    ? "bg-teal-400 text-slate-950"
                    : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
                  }`}
              >
                <SlidersHorizontal size={15} className="sm:hidden" />
                <SlidersHorizontal size={17} className="hidden sm:block" />
                Filters
                {(selectedRating > 0 || selectedPrice !== "all" || selectedTags.size > 0) && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-[9px] font-black text-white sm:h-5 sm:w-5 sm:text-[10px]">
                    {(selectedRating > 0 ? 1 : 0) + (selectedPrice !== "all" ? 1 : 0) + selectedTags.size}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Advanced Filters panel overlay */}
          <AnimatePresence>
            {showAdvancedFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-t border-[var(--border)] mt-4 pt-4 grid gap-4 sm:grid-cols-3 text-xs sm:text-sm font-semibold"
              >
                {/* Rating Filter */}
                <div className="space-y-2">
                  <span className="block text-xs font-black uppercase text-slate-400">Minimum Rating</span>
                  <div className="flex gap-2">
                    {([0, 4.0, 4.5] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSelectedRating(r)}
                        className={`flex-1 py-2 text-center rounded-lg font-bold border transition ${selectedRating === r
                            ? "bg-teal-400/10 border-teal-400/40 text-teal-300 font-black"
                            : "border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900"
                          }`}
                      >
                        {r === 0 ? "Any" : `${r}★+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Filter */}
                <div className="space-y-2">
                  <span className="block text-xs font-black uppercase text-slate-400">Price Range</span>
                  <div className="flex gap-2">
                    {(["all", "$", "$$", "$$$"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPrice(p)}
                        className={`flex-1 py-2 text-center rounded-lg font-bold border transition uppercase ${selectedPrice === p
                            ? "bg-teal-400/10 border-teal-400/40 text-teal-300 font-black"
                            : "border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900"
                          }`}
                      >
                        {p === "all" ? "Any" : p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags Filter */}
                <div className="space-y-2">
                  <span className="block text-xs font-black uppercase text-slate-400">Amenities & Vibes</span>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { id: "pet-friendly", label: "🐾 Pet Friendly" },
                      { id: "family-friendly", label: "👨‍👩‍👧 Family Friendly" },
                      { id: "work-friendly", label: "💻 Work Friendly" },
                      { id: "heritage", label: "🏛️ Heritage/Cultural" },
                      { id: "scenic", label: "🌅 Scenic Views" },
                    ] as const).map((tag) => {
                      const active = selectedTags.has(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTagFilter(tag.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${active
                              ? "bg-teal-400/10 border-teal-400/40 text-teal-300 font-black"
                              : "border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900"
                            }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => {
              const active = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition sm:px-4 sm:text-sm ${active
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
                  ? `${totalFilteredCount} matching places`
                  : `${allPlaces.length} ${usingLivePlaces ? "live + curated" : "curated"} ${activeCity} places`}
            </span>
            {selectedMood && (
              <span className="rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1.5 font-semibold text-teal-100">
                Mood: {getMoodLabel(selectedMood)}
              </span>
            )}
            {activeCategory !== "all" && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5">
                {activeCategory === "free" ? "Free 2-3 hrs" : activeCategory === "night-drive" ? "Night Drives" : getCategoryLabel(activeCategory as PlaceCategory)}
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
              userLocation={distanceReference}
              selectedPlace={selectedPlace}
              onMarkerClick={setSelectedPlace}
              className="h-[320px] min-h-[320px] rounded-lg sm:h-[420px] sm:min-h-[420px]"
            />
          </motion.div>
        )}

        <div className="py-4">
          {hasFilters ? (
            <>
              <DiscoverySection
                title="Filtered Results"
                description="Your current search and filters, sorted the way you chose."
                places={filteredPlaces}
                loading={livePlacesLoading}
                onPlaceClick={setSelectedPlace}
                onSavePlace={toggleSave}
                savedPlaceIds={savedPlaceIds}
              />
              {hasMore && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-6 py-3 text-sm font-bold hover:bg-[var(--panel)]"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
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
                carousel={true}
              />
            ))
          )}
        </div>
      </div>

      <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
    </div>
  );
}
