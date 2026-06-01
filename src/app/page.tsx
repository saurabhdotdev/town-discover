"use client";

import { useEffect, useMemo, useState } from "react";
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
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { DiscoverySection } from "@/components/cards/DiscoverySection";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { LocationPermissionCard } from "@/components/common/LocationPermissionCard";
import { MoodPicker } from "@/components/common/MoodPicker";
import { getPlacesWithDistance } from "@/data/mock-places";
import { getFallbackPlacesForCity } from "@/lib/client/fallback-places";
import { useLivePlaces } from "@/hooks/useLivePlaces";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { Place, PlaceCategory } from "@/types";
import { formatDistance, getCategoryLabel } from "@/lib/utils";
import { CITY_CENTERS, getCityFromQuery, stripCityFromQuery } from "@/lib/pune-location";
import { useCitySelection } from "@/hooks/useCitySelection";
import { useMoodSelection } from "@/hooks/useMoodSelection";
import { getMoodLabel, getTopMoodRecommendations } from "@/lib/mood-recommendations";
import { combineLiveAndCuratedPlaces } from "@/lib/combine-places";
import { filterAndRankPlaces } from "@/lib/place-search";
import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingModal } from "@/components/common/OnboardingModal";

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
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<HomeFilter>("all");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const { selectedCity, hasChosenCity, chooseCity, preferDetectedCity } = useCitySelection();
  const { prefs: onboardingPrefs, showOnboarding, hydrated, completeOnboarding } = useOnboarding();

  // Apply onboarding city preference on first load
  useEffect(() => {
    if (onboardingPrefs?.city && !hasChosenCity) {
      chooseCity(onboardingPrefs.city);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingPrefs?.city]);
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinItems, setSpinItems] = useState<string[]>([]);
  const [spinIndex, setSpinIndex] = useState(0);
  const [surprisedPlace, setSurprisedPlace] = useState<Place | null>(null);
  const [now, setNow] = useState(() => new Date());
  const { savedPlaceIds, toggleSave } = useSavedPlaces();
  const { selectedMood, setSelectedMood } = useMoodSelection();
  const {
    location,
    loading: locationLoading,
    error: locationError,
    source: locationSource,
    city: detectedCity,
    requestLocation,
  } = useGeolocation();
  const activeCity = getCityFromQuery(query) ?? (!hasChosenCity && locationSource === "browser" ? detectedCity : selectedCity);
  const activeLocation =
    locationSource === "browser" && location && activeCity === detectedCity ? location : CITY_CENTERS[activeCity];
  const liveQuery = query.trim() || activeCity;
  const { places: livePlaces, loading: livePlacesLoading, error: livePlacesError } = useLivePlaces(activeLocation, liveQuery);

  const usingLivePlaces = livePlaces.length > 0;
  const [curatedPlaces, setCuratedPlaces] = useState<Place[]>([]);

  useEffect(() => {
    let cancelled = false;
    getFallbackPlacesForCity(activeCity).then((data) => {
      if (!cancelled) setCuratedPlaces(data);
    });
    return () => {
      cancelled = true;
    };
  }, [activeCity]);
  const allPlaces = useMemo(
    () =>
      getPlacesWithDistance(combineLiveAndCuratedPlaces(livePlaces, curatedPlaces), activeLocation),
    [activeLocation, curatedPlaces, livePlaces]
  );
  const featuredPlace = allPlaces.find((place) => place.isTrending) ?? allPlaces[0] ?? null;
  const nearbyPlaces = useMemo(
    () => [...allPlaces].sort((a, b) => a.distance - b.distance).slice(0, 9),
    [allPlaces]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const placeId = new URLSearchParams(window.location.search).get("place");
    if (!placeId || selectedPlace?.id === placeId) return;

    const linkedPlace = allPlaces.find((place) => place.id === placeId);
    if (linkedPlace) {
      setTimeout(() => {
        setSelectedPlace(linkedPlace);
      }, 0);
    } else {
      fetch(`/api/places/resolve?ids=${encodeURIComponent(placeId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.places && data.places.length > 0) {
            setSelectedPlace(data.places[0]);
          }
        })
        .catch((err) => console.error("Error resolving deep-linked place on home:", err));
    }
  }, [allPlaces, selectedPlace?.id]);

  const triggerSurpriseMe = () => {
    if (allPlaces.length === 0) return;
    setSurpriseOpen(true);
    setIsSpinning(true);
    setSurprisedPlace(null);

    // Pick a random place
    const randomIndex = Math.floor(Math.random() * allPlaces.length);
    const chosen = allPlaces[randomIndex];

    // Generate a list of titles to spin through
    const randomPool = [...allPlaces].sort(() => 0.5 - Math.random());
    const titles = randomPool.slice(0, 12).map(p => p.title);

    // Make sure the chosen one is at the end of the spin sequence
    if (!titles.includes(chosen.title)) {
      titles.push(chosen.title);
    } else {
      const idx = titles.indexOf(chosen.title);
      titles.splice(idx, 1);
      titles.push(chosen.title);
    }

    setSpinItems(titles);
    setSpinIndex(0);

    let curIndex = 0;
    let delay = 60; // Initial delay in ms
    const totalTicks = titles.length;

    const tick = () => {
      curIndex++;
      if (curIndex < totalTicks) {
        setSpinIndex(curIndex);
        delay = delay * 1.25; // Exponential deceleration
        setTimeout(tick, delay);
      } else {
        setIsSpinning(false);
        setSurprisedPlace(chosen);
      }
    };

    setTimeout(tick, delay);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const normalizedQuery = stripCityFromQuery(query).toLowerCase();
  const filteredPlaces = filterAndRankPlaces(allPlaces, {
    query: normalizedQuery,
    category: activeFilter,
    now,
    explicitMood: selectedMood,
    useMoodRanking: selectedMood != null,
  }).slice(0, 12);

  const moodPicks = useMemo(() => {
    if (!selectedMood) return [];
    return getTopMoodRecommendations(allPlaces, {
      query: normalizedQuery,
      now,
      explicitMood: selectedMood,
      limit: 9,
    });
  }, [allPlaces, normalizedQuery, now, selectedMood]);

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
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-[var(--fresh)]">
                <Compass size={15} />
                {usingLivePlaces ? `Live + curated in ${activeCity}` : `${activeCity} discovery`}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500/20 via-teal-500/20 to-amber-500/20 border border-cyan-500/30 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                <Sparkles size={13} className="text-cyan-300 animate-pulse" />
                Sheher Explorer
              </span>
            </div>
            <h1 className="max-w-4xl text-3xl font-black leading-tight tracking-tight text-[var(--foreground)] sm:text-4xl md:text-6xl">
              Find the right place for right now.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted-strong)] sm:text-base md:text-lg md:leading-7">
              Sheher helps you browse cafes, food spots, bars, heritage walks, and weekend plans city by city.
            </p>
          </div>

          <div className="app-surface rounded-lg p-3 md:p-4">
            <CitySwitcher
              value={activeCity}
              onChange={(city) => {
                chooseCity(city);
                setQuery("");
                setActiveFilter("all");
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
            <label className="relative mt-3 block">
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
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition sm:px-4 sm:text-sm ${active
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
              { label: usingLivePlaces ? "All Places" : "Curated Places", value: allPlaces.length.toString() },
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
            <button
              type="button"
              onClick={triggerSurpriseMe}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-3 font-black text-white transition hover:opacity-95 shadow-lg shadow-rose-500/20"
            >
              Surprise Me
              <Sparkles size={18} />
            </button>
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
                  Try Bangalore cafes, beach sunrise in Chennai, or events in Delhi.
                </p>
              </div>
            </div>
          )}
        </motion.aside>
      </section>

      <section className="mx-auto max-w-screen-xl px-3 pb-12 sm:px-4 md:px-6 md:pb-16">
        {selectedMood && (
          <DiscoverySection
            title={`Picked for your ${getMoodLabel(selectedMood).toLowerCase()} mood`}
            description={`Places in ${activeCity} matched to how you're feeling right now.`}
            places={moodPicks}
            loading={livePlacesLoading && !usingLivePlaces}
            onPlaceClick={setSelectedPlace}
            onSavePlace={toggleSave}
            savedPlaceIds={savedPlaceIds}
          />
        )}

        <DiscoverySection
          title={
            selectedMood
              ? "More places"
              : query || activeFilter !== "all"
                ? "Matching Places"
                : usingLivePlaces
                  ? "Live Nearby"
                  : "Start Here"
          }
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

            <DiscoverySection
              title="Family, Pet & Traveler Favorites"
              description="Highly rated, welcoming spots perfect for international visitors, family outings, and pet companions."
              places={allPlaces.filter((place) =>
                place.tags.some(tag => ["foreigner-friendly", "family-friendly", "pet-friendly", "heritage", "tourist-friendly", "cultural", "family"].includes(tag))
              ).slice(0, 8)}
              loading={livePlacesLoading && !usingLivePlaces}
              onPlaceClick={setSelectedPlace}
              onSavePlace={toggleSave}
              savedPlaceIds={savedPlaceIds}
            />
          </>
        )}
      </section>

      <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />

      {/* Onboarding */}
      {hydrated && showOnboarding && (
        <OnboardingModal
          onComplete={(prefs) => {
            completeOnboarding(prefs);
            chooseCity(prefs.city);
            if (prefs.interests.length > 0) {
              // Map first interest to a home filter if applicable
              const mappable = ["cafe", "restaurant", "event", "nightlife"] as const;
              const first = prefs.interests.find((i) => mappable.includes(i as any));
              if (first) setActiveFilter(first as any);
            }
          }}
        />
      )}

      {/* Surprise Me Spinner Overlay */}
      {surpriseOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 text-center shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setSurpriseOpen(false)}
              className="absolute right-4 top-4 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <X size={20} />
            </button>

            <div className="mb-6 flex flex-col items-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 shadow-inner">
                <Sparkles size={24} className={isSpinning ? "animate-spin" : "animate-pulse"} />
              </div>
              <h3 className="mt-3 text-xl font-black text-[var(--foreground)]">Spontaneous Vibe Spinner</h3>
              <p className="text-xs font-semibold text-[var(--muted)]">Letting fate choose your next spot in {activeCity}</p>
            </div>

            {/* Spinning Box */}
            <div className="relative my-6 flex h-24 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--input)] shadow-inner">
              <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[var(--input)] to-transparent pointer-events-none z-10" />
              <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-[var(--input)] to-transparent pointer-events-none z-10" />

              <div className="flex flex-col items-center justify-center">
                {isSpinning ? (
                  <motion.div
                    key={spinIndex}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="text-lg font-black tracking-tight text-[var(--foreground)] px-4 text-center line-clamp-1"
                  >
                    {spinItems[spinIndex]}
                  </motion.div>
                ) : surprisedPlace ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-1 px-4"
                  >
                    <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
                      {getCategoryLabel(surprisedPlace.category)}
                    </span>
                    <span className="text-xl font-black tracking-tight text-[var(--foreground)] text-center line-clamp-1">
                      {surprisedPlace.title}
                    </span>
                    <span className="text-xs font-semibold text-[var(--muted)]">{surprisedPlace.locality}</span>
                  </motion.div>
                ) : null}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col gap-2">
              {!isSpinning && surprisedPlace ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSurpriseOpen(false);
                      setSelectedPlace(surprisedPlace);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] py-3 font-black text-[var(--primary-foreground)] transition hover:opacity-90"
                  >
                    Reveal Details
                    <Compass size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={triggerSurpriseMe}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] py-3 font-black text-[var(--foreground)] transition hover:bg-[var(--panel)]"
                  >
                    Spin Again 🔄
                  </button>
                </>
              ) : (
                <div className="py-4 text-sm font-semibold text-[var(--muted-strong)] animate-pulse">
                  Shuffling the vibes...
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
