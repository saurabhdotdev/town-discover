"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  CalendarDays,
  ChevronRight,
  Coffee,
  Compass,
  Flame,
  IceCreamCone,
  LocateFixed,
  Map,
  MapPin,
  Search,
  Sparkles,
  Star,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { DiscoverySection } from "@/components/cards/DiscoverySection";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { LocationPermissionCard } from "@/components/common/LocationPermissionCard";
import { MoodPicker } from "@/components/common/MoodPicker";
import { WanderlustDrop } from "@/components/common/WanderlustDrop";
import { getPlacesWithDistance } from "@/data/mock-places";
import { getFallbackPlacesForCity } from "@/lib/client/fallback-places";
import { getCityWeather, filterPlacesByWeather } from "@/lib/weather";
import { WeatherWidget } from "@/components/common/WeatherWidget";
import { SmartSearchBar } from "@/components/common/SmartSearchBar";
import { useLivePlaces } from "@/hooks/useLivePlaces";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { Place, PlaceCategory } from "@/types";
import type { LiveEvent } from "@/app/api/events/live/route";
import { formatDistance, getCategoryLabel, isVegetarianPlace } from "@/lib/utils";
import { CITY_CENTERS, getCityFromQuery, stripCityFromQuery } from "@/lib/pune-location";
import { useCitySelection } from "@/hooks/useCitySelection";
import { useMoodSelection } from "@/hooks/useMoodSelection";
import { getMoodLabel, getTopMoodRecommendations, inferMoodProfile, getMoodMatchScore } from "@/lib/mood-recommendations";
import { combineLiveAndCuratedPlaces } from "@/lib/combine-places";
import { filterAndRankPlaces } from "@/lib/place-search";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { OutingPlannerTabs } from "@/components/home/OutingPlannerTabs";

// Lazy-load heavy components that are interaction-triggered or below the fold
const PlaceDetailModal = dynamic(
  () => import("@/components/cards/PlaceDetailModal").then((mod) => mod.PlaceDetailModal),
  { ssr: false }
);
const OnboardingModal = dynamic(
  () => import("@/components/common/OnboardingModal").then((mod) => mod.OnboardingModal),
  { ssr: false }
);
const VibeRadar = dynamic(
  () => import("@/components/common/VibeRadar").then((mod) => mod.VibeRadar),
  { ssr: false }
);

type HomeFilter = "all" | "trending" | "open" | "street-food" | "ice-cream" | PlaceCategory;

const filters: { id: HomeFilter; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: <Sparkles size={17} /> },
  { id: "trending", label: "Trending", icon: <Flame size={17} /> },
  { id: "open", label: "Open Now", icon: <LocateFixed size={17} /> },
  { id: "street-food", label: "Street Food", icon: <Store size={17} /> },
  { id: "ice-cream", label: "Ice Cream", icon: <IceCreamCone size={17} /> },
  { id: "cafe", label: "Cafes", icon: <Coffee size={17} /> },
  { id: "restaurant", label: "Food", icon: <UtensilsCrossed size={17} /> },
  { id: "event", label: "Events", icon: <CalendarDays size={17} /> },
];

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<HomeFilter>("all");
  const [vegOnly, setVegOnly] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const { selectedCity, hasChosenCity, chooseCity, preferDetectedCity } = useCitySelection();
  const { prefs: onboardingPrefs, showOnboarding, hydrated, completeOnboarding } = useOnboarding();
  const [confetti, setConfetti] = useState<{ id: number; left: number; color: string; delay: number }[]>([]);
  const [trailGenerating, setTrailGenerating] = useState(false);
  const [timeBudget, setTimeBudget] = useState<"1" | "3" | "5">("3");

  // Standalone Trail Generator widget states
  const [widgetStartMode, setWidgetStartMode] = useState<"random" | "geo" | "place">("random");
  const [widgetStartPlaceId, setWidgetStartPlaceId] = useState<string>("");
  const [widgetTimeBudget, setWidgetTimeBudget] = useState<"1" | "3" | "5">("3");
  const [widgetTheme, setWidgetTheme] = useState<"mix" | "cafe" | "food" | "scenic">("mix");
  const [widgetGenerating, setWidgetGenerating] = useState(false);
  const [widgetSearchQuery, setWidgetSearchQuery] = useState("");
  const [widgetSearchFocused, setWidgetSearchFocused] = useState(false);
  const [widgetPreviewStops, setWidgetPreviewStops] = useState<Place[] | null>(null);
  const [widgetPreviewStats, setWidgetPreviewStats] = useState<{ distance: number; duration: number } | null>(null);
  const [widgetPreviewName, setWidgetPreviewName] = useState("");

  // Area Layover Planner states
  const [activePlannerTab, setActivePlannerTab] = useState<"route" | "area" | "outings">("route");
  const [selectedLocality, setSelectedLocality] = useState("");
  const [areaTimeBudget, setAreaTimeBudget] = useState<"1" | "3" | "5">("3");
  const [areaPlanStops, setAreaPlanStops] = useState<Place[] | null>(null);
  const [areaPlanBudgetEstimate, setAreaPlanBudgetEstimate] = useState("");

  // Local Outings Planner states
  const [outingType, setOutingType] = useState<"friends" | "date" | "family" | "solo">("friends");
  const [outingVibe, setOutingVibe] = useState<"food" | "cafe" | "culture" | "nightlife">("food");
  const [outingTimeOfDay, setOutingTimeOfDay] = useState<"morning" | "evening" | "full">("evening");
  const [outingStops, setOutingStops] = useState<Place[] | null>(null);
  const [outingGenerating, setOutingGenerating] = useState(false);
  const [outingPreviewName, setOutingPreviewName] = useState("");
  const [liveEventSuggestions, setLiveEventSuggestions] = useState<any[]>([]);
  const [hangoutSuggestions, setHangoutSuggestions] = useState<any[]>([]);

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

  const rawPlaces = useMemo(
    () =>
      getPlacesWithDistance(combineLiveAndCuratedPlaces(livePlaces, curatedPlaces), activeLocation),
    [activeLocation, curatedPlaces, livePlaces]
  );

  const allPlaces = useMemo(() => {
    if (vegOnly) {
      return rawPlaces.filter(isVegetarianPlace);
    }
    return rawPlaces;
  }, [rawPlaces, vegOnly]);

  const vibeScores = useMemo(() => {
    const scores: Record<string, number> = {};
    if (!selectedMood) return scores;

    const mood = inferMoodProfile({ explicitMood: selectedMood, now });
    allPlaces.forEach((place) => {
      const rawScore = getMoodMatchScore(place, mood, now);
      const percentage = Math.round(
        Math.min(99, Math.max(70, 70 + (rawScore * 25)))
      );
      scores[place.id] = percentage;
    });

    return scores;
  }, [allPlaces, selectedMood, now]);

  const weather = useMemo(() => {
    return getCityWeather(activeCity as any, now);
  }, [activeCity, now]);

  const weatherRecommendations = useMemo(() => {
    return filterPlacesByWeather(allPlaces, weather.condition).slice(0, 8);
  }, [allPlaces, weather.condition]);

  const featuredPlace = allPlaces.find((place) => place.isTrending) ?? allPlaces[0] ?? null;
  const nearbyPlaces = useMemo(
    () => [...allPlaces].sort((a, b) => a.distance - b.distance).slice(0, 9),
    [allPlaces]
  );
  const iceCreamPlaces = useMemo(
    () => allPlaces.filter((place) => place.category === "ice-cream" || place.category === "dessert"),
    [allPlaces]
  );
  const iceCreamLocalities = useMemo(
    () => Array.from(new Set(iceCreamPlaces.map((place) => place.locality))).slice(0, 4),
    [iceCreamPlaces]
  );
  const influencerPlaces = useMemo(
    () => [...allPlaces]
      .filter((place) => place.influencerFeatures && place.influencerFeatures.length > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 12),
    [allPlaces]
  );
  const trailPlaces = useMemo(
    () => allPlaces.filter((place) => place.tags.includes("trail")),
    [allPlaces]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateMouseCoords = (e: MouseEvent) => {
      document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
    };
    window.addEventListener("mousemove", updateMouseCoords);
    return () => window.removeEventListener("mousemove", updateMouseCoords);
  }, []);

  const triggerSurpriseMe = () => {
    if (allPlaces.length === 0) return;
    setSurpriseOpen(true);
    setIsSpinning(true);
    setSurprisedPlace(null);
    setConfetti([]);
    setTimeBudget("3");

    // Pick a random place
    const randomIndex = Math.floor(Math.random() * allPlaces.length);
    const chosen = allPlaces[randomIndex];

    // Determine spin items
    const items = allPlaces
      .filter((p) => p.id !== chosen.id)
      .slice(0, 5)
      .map((p) => p.title);
    items.push(chosen.title);
    setSpinItems(items);

    let currentIdx = 0;
    let delay = 100;
    const ticks = items.length;

    const tick = () => {
      setSpinIndex(currentIdx);
      currentIdx++;

      if (currentIdx < ticks) {
        delay += 60; // slow down spinner
        setTimeout(tick, delay);
      } else {
        setIsSpinning(false);
        setSurprisedPlace(chosen);
        
        // Trigger confetti particle burst!
        const colors = ["#2dd4bf", "#10b981", "#f43f5e", "#eab308", "#3b82f6", "#a855f7", "#ff007f"];
        const particles = Array.from({ length: 40 }).map((_, i) => ({
          id: Math.random(),
          left: Math.random() * 100,
          color: colors[Math.floor(Math.random() * colors.length)],
          delay: Math.random() * 0.4,
        }));
        setConfetti(particles);
      }
    };

    setTimeout(tick, delay);
  };

  const getThemeScore = (place: Place, theme: "mix" | "cafe" | "food" | "scenic") => {
    let score = 0;
    if (theme === "cafe") {
      if (place.category === "cafe") score += 10;
      if (place.category === "dessert" || place.category === "ice-cream") score += 5;
    } else if (theme === "food") {
      if (["restaurant", "street-food", "food-stall"].includes(place.category)) score += 10;
      if (["dessert", "ice-cream"].includes(place.category)) score += 5;
    } else if (theme === "scenic") {
      if (place.tags.some(t => ["scenic", "viewpoint", "heritage", "walk", "nature", "park"].includes(t))) score += 10;
      if (place.category === "event") score += 5;
    }
    return score;
  };

  const handleGenerateTrail = async (
    startPlace: Place,
    customTimeBudget?: "1" | "3" | "5",
    customTheme?: "mix" | "cafe" | "food" | "scenic",
    isWidget?: boolean
  ) => {
    const activeGeneratingStateSetter = isWidget ? setWidgetGenerating : setTrailGenerating;
    const isGenerating = isWidget ? widgetGenerating : trailGenerating;
    if (isGenerating) return;
    activeGeneratingStateSetter(true);

    try {
      // 1. Determine target stops count and distance threshold based on timeBudget
      const budget = customTimeBudget ?? timeBudget;
      const theme = customTheme ?? "mix";
      // 1: 1 Hour -> 2 stops, max radius 600m
      // 3: 2-3 Hours -> 3 stops, max radius 1.8km
      // 5: 5+ Hours -> 4 stops, max radius 5km
      const targetStops = budget === "1" ? 2 : budget === "5" ? 4 : 3;
      const maxRadius = budget === "1" ? 0.006 : budget === "5" ? 0.05 : 0.018; // approx degrees

      const isWithinRadius = (p: Place) => {
        const latDelta = p.latitude - startPlace.latitude;
        const lngDelta = p.longitude - startPlace.longitude;
        const distanceDeg = Math.hypot(latDelta, lngDelta);
        return distanceDeg <= maxRadius;
      };

      // Filter places in same city within radius (excluding startPlace itself)
      const sameCityPlaces = allPlaces.filter(
        (p) => p.city.toLowerCase() === startPlace.city.toLowerCase() && p.id !== startPlace.id && isWithinRadius(p)
      );

      // Group by category to find diverse spots
      const categoryGroups: Record<string, Place[]> = {};
      sameCityPlaces.forEach((p) => {
        if (!categoryGroups[p.category]) categoryGroups[p.category] = [];
        categoryGroups[p.category].push(p);
      });

      const stops: Place[] = [startPlace];
      const categoriesUsed = new Set<string>([startPlace.category]);

      // Choose up to (targetStops - 1) other categories
      const availableCategories = Object.keys(categoryGroups).filter((c) => !categoriesUsed.has(c));
      
      // Sort categories prioritizing those matching customTheme
      if (theme !== "mix") {
        availableCategories.sort((a, b) => {
          const repA = categoryGroups[a][0];
          const repB = categoryGroups[b][0];
          return getThemeScore(repB, theme) - getThemeScore(repA, theme);
        });
      } else {
        // Shuffle categories
        availableCategories.sort(() => 0.5 - Math.random());
      }

      for (const cat of availableCategories) {
        if (stops.length >= targetStops) break;
        const group = categoryGroups[cat];
        
        // Sort by distance to the startPlace to keep them close (walkable/nearby)
        const sortedByProximity = [...group].sort((a, b) => {
          const distA = Math.hypot(a.latitude - startPlace.latitude, a.longitude - startPlace.longitude);
          const distB = Math.hypot(b.latitude - startPlace.latitude, b.longitude - startPlace.longitude);
          return distA - distB;
        });

        if (sortedByProximity[0]) {
          stops.push(sortedByProximity[0]);
          categoriesUsed.add(cat);
        }
      }

      // Fallback: If we couldn't get targetStops distinct categories within radius, fill up with any close places from sameCityPlaces
      if (stops.length < targetStops) {
        const remaining = sameCityPlaces
          .filter((p) => !stops.some((s) => s.id === p.id))
          .sort((a, b) => {
            const distA = Math.hypot(a.latitude - startPlace.latitude, a.longitude - startPlace.longitude);
            const distB = Math.hypot(b.latitude - startPlace.latitude, b.longitude - startPlace.longitude);
            return distA - distB;
          });
        while (stops.length < targetStops && remaining.length > 0) {
          stops.push(remaining.shift()!);
        }
      }

      // Secondary fallback: If radius was too restrictive and we still need stops, search beyond the radius
      if (stops.length < targetStops) {
        const beyondRadiusPlaces = allPlaces.filter(
          (p) => p.city.toLowerCase() === startPlace.city.toLowerCase() && p.id !== startPlace.id && !stops.some((s) => s.id === p.id)
        ).sort((a, b) => {
          const distA = Math.hypot(a.latitude - startPlace.latitude, a.longitude - startPlace.longitude);
          const distB = Math.hypot(b.latitude - startPlace.latitude, b.longitude - startPlace.longitude);
          return distA - distB;
        });
        while (stops.length < targetStops && beyondRadiusPlaces.length > 0) {
          stops.push(beyondRadiusPlaces.shift()!);
        }
      }

      if (stops.length < 2) {
        alert("Not enough places in this city to plan a trail!");
        activeGeneratingStateSetter(false);
        return;
      }

      const durationLabel = budget === "1" ? "1-Hour" : budget === "5" ? "5-Hour" : "2-3 Hour";
      const themeLabel = theme === "cafe" ? "Cafe Hop" : theme === "food" ? "Foodie" : theme === "scenic" ? "Scenic" : "Spontaneous";
      const trailName = `${themeLabel} ${durationLabel} ${startPlace.city} Walk`;

      if (isWidget) {
        const coordString = stops.map((s) => `${s.longitude},${s.latitude}`).join(";");
        const routeUrl = `/api/places/route?coords=${coordString}&mode=foot`;
        let distanceKm = 0;
        let durationMinutes = 0;

        try {
          const res = await fetch(routeUrl, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = await res.json();
            if (data.code === "Ok" && data.routes?.[0]) {
              const route = data.routes[0];
              distanceKm = parseFloat((route.distance / 1000).toFixed(1));
              durationMinutes = Math.round(route.duration / 60);
            }
          }
        } catch (err) {
          console.warn("OSRM routing preview failed", err);
        }

        if (distanceKm === 0) {
          distanceKm = budget === "1" ? 0.6 : budget === "5" ? 4.5 : 1.8;
          durationMinutes = budget === "1" ? 15 : budget === "5" ? 75 : 30;
        }

        setWidgetPreviewStops(stops);
        setWidgetPreviewStats({ distance: distanceKm, duration: durationMinutes });
        setWidgetPreviewName(trailName);
        activeGeneratingStateSetter(false);
        return;
      }

      // If user is logged in, we try to POST to /api/trip-plans to save it permanently
      if (user) {
        const routePathCoords: { latitude: number; longitude: number }[] = [];
        const coordString = stops.map((s) => `${s.longitude},${s.latitude}`).join(";");
        const routeUrl = `/api/places/route?coords=${coordString}&mode=foot`;
        let distanceKm = 0;
        let durationMinutes = 0;

        try {
          const res = await fetch(routeUrl, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = await res.json();
            if (data.code === "Ok" && data.routes?.[0]) {
              const route = data.routes[0];
              distanceKm = parseFloat((route.distance / 1000).toFixed(1));
              durationMinutes = Math.round(route.duration / 60);
              route.geometry.coordinates.forEach(([lng, lat]: [number, number]) => {
                routePathCoords.push({ latitude: lat, longitude: lng });
              });
            }
          }
        } catch (err) {
          console.warn("OSRM routing failed, falling back to direct paths", err);
        }

        // If OSRM failed, use direct point coordinates
        if (routePathCoords.length === 0) {
          stops.forEach((s) => {
            routePathCoords.push({ latitude: s.latitude, longitude: s.longitude });
          });
          distanceKm = budget === "1" ? 0.6 : budget === "5" ? 4.5 : 1.8;
          durationMinutes = budget === "1" ? 15 : budget === "5" ? 75 : 30;
        }

        const payload = {
          name: trailName,
          source: stops[0].locality || startPlace.city,
          destination: stops[stops.length - 1].locality || startPlace.city,
          distanceKm,
          durationMinutes,
          routePath: routePathCoords,
          stops,
        };

        const saveRes = await fetch("/api/trip-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (saveRes.ok) {
          const data = await saveRes.json();
          if (data.plan?.id) {
            if (!isWidget) setSurpriseOpen(false);
            router.push(`/trip/${data.plan.id}`);
            return;
          }
        }
      }

      // Guest / Fallback: Redirect to /map page with mode=trip and serialize stops
      const stopIds = stops.map((s) => s.id).join(",");
      if (!isWidget) setSurpriseOpen(false);
      router.push(`/map?mode=trip&stops=${encodeURIComponent(stopIds)}&sourceName=${encodeURIComponent(stops[0].title)}&destName=${encodeURIComponent(stops[stops.length - 1].title)}&trailName=${encodeURIComponent(trailName)}`);
    } catch (error) {
      console.error("Failed to generate spontaneous trail:", error);
      alert("Something went wrong generating the trail. Opening the map instead.");
      router.push("/map");
    } finally {
      activeGeneratingStateSetter(false);
    }
  };


  const handleWidgetGenerateTrail = async () => {
    if (allPlaces.length === 0) {
      alert("No places available in this city to plan a trail.");
      return;
    }

    let startPlace: Place | null = null;
    if (widgetStartMode === "geo") {
      if (location) {
        let minD = Infinity;
        allPlaces.forEach((p) => {
          const d = Math.hypot(p.latitude - location.latitude, p.longitude - location.longitude);
          if (d < minD) {
            minD = d;
            startPlace = p;
          }
        });
      }
      if (!startPlace) {
        // fallback to random
        startPlace = allPlaces[Math.floor(Math.random() * allPlaces.length)];
      }
    } else if (widgetStartMode === "place") {
      startPlace = allPlaces.find((p) => p.id === widgetStartPlaceId) || null;
      if (!startPlace) {
        startPlace = allPlaces[0];
      }
    } else {
      // random popular spot
      const trending = allPlaces.filter((p) => p.isTrending || p.rating >= 4.5);
      const pool = trending.length > 0 ? trending : allPlaces;
      startPlace = pool[Math.floor(Math.random() * pool.length)];
    }

    if (!startPlace) {
      alert("Please select a starting spot first!");
      return;
    }

    await handleGenerateTrail(startPlace, widgetTimeBudget, widgetTheme, true);
  };

  useEffect(() => {
    if (allPlaces.length > 0 && !widgetStartPlaceId) {
      setWidgetStartPlaceId(allPlaces[0].id);
    }
  }, [allPlaces, widgetStartPlaceId]);

  const filteredAutocompletePlaces = useMemo(() => {
    if (!widgetSearchQuery.trim()) {
      return allPlaces.slice(0, 10);
    }
    return allPlaces.filter((p) =>
      p.title.toLowerCase().includes(widgetSearchQuery.toLowerCase()) ||
      p.locality.toLowerCase().includes(widgetSearchQuery.toLowerCase())
    ).slice(0, 10);
  }, [allPlaces, widgetSearchQuery]);

  const handleLaunchPreviewTrail = async () => {
    if (!widgetPreviewStops || widgetPreviewStops.length === 0) return;
    
    setWidgetGenerating(true);
    const stops = widgetPreviewStops;
    const trailName = widgetPreviewName;

    try {
      if (user) {
        const routePathCoords: { latitude: number; longitude: number }[] = [];
        const coordString = stops.map((s) => `${s.longitude},${s.latitude}`).join(";");
        const routeUrl = `/api/places/route?coords=${coordString}&mode=foot`;
        let distanceKm = widgetPreviewStats?.distance ?? 0;
        let durationMinutes = widgetPreviewStats?.duration ?? 0;

        try {
          const res = await fetch(routeUrl, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = await res.json();
            if (data.code === "Ok" && data.routes?.[0]) {
              const route = data.routes[0];
              distanceKm = parseFloat((route.distance / 1000).toFixed(1));
              durationMinutes = Math.round(route.duration / 60);
              route.geometry.coordinates.forEach(([lng, lat]: [number, number]) => {
                routePathCoords.push({ latitude: lat, longitude: lng });
              });
            }
          }
        } catch (err) {
          console.warn("OSRM routing failed, falling back to direct paths", err);
        }

        if (routePathCoords.length === 0) {
          stops.forEach((s) => {
            routePathCoords.push({ latitude: s.latitude, longitude: s.longitude });
          });
        }

        const payload = {
          name: trailName,
          source: stops[0].locality || stops[0].city,
          destination: stops[stops.length - 1].locality || stops[0].city,
          distanceKm,
          durationMinutes,
          routePath: routePathCoords,
          stops,
        };

        const saveRes = await fetch("/api/trip-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (saveRes.ok) {
          const data = await saveRes.json();
          if (data.plan?.id) {
            router.push(`/trip/${data.plan.id}`);
            return;
          }
        }
      }

      const stopIds = stops.map((s) => s.id).join(",");
      router.push(`/map?mode=trip&stops=${encodeURIComponent(stopIds)}&sourceName=${encodeURIComponent(stops[0].title)}&destName=${encodeURIComponent(stops[stops.length - 1].title)}&trailName=${encodeURIComponent(trailName)}`);
    } catch (err) {
      console.error("Failed to launch preview trail:", err);
      alert("Error opening map. Opening standard map view instead.");
      router.push("/map");
    } finally {
      setWidgetGenerating(false);
    }
  };

  const uniqueLocalities = useMemo(() => {
    const set = new Set<string>();
    allPlaces.forEach((p) => {
      if (p.locality) set.add(p.locality);
    });
    return Array.from(set).sort();
  }, [allPlaces]);

  useEffect(() => {
    if (uniqueLocalities.length > 0 && !selectedLocality) {
      setSelectedLocality(uniqueLocalities[0]);
    }
  }, [uniqueLocalities, selectedLocality]);

  useEffect(() => {
    if (uniqueLocalities.length > 0) {
      setSelectedLocality(uniqueLocalities[0]);
    }
    setWidgetPreviewStops(null);
    setWidgetPreviewStats(null);
    setAreaPlanStops(null);
  }, [activeCity, uniqueLocalities]);

  const handleGenerateAreaPlan = () => {
    if (!selectedLocality) return;

    const localitySpots = allPlaces.filter(
      (p) => p.locality.toLowerCase() === selectedLocality.toLowerCase()
    );

    let candidateSpots = [...localitySpots];
    if (candidateSpots.length < 3) {
      const centroidLat = localitySpots[0]?.latitude ?? allPlaces[0]?.latitude ?? 0;
      const centroidLng = localitySpots[0]?.longitude ?? allPlaces[0]?.longitude ?? 0;
      const otherSpots = allPlaces.filter((p) => {
        if (p.locality.toLowerCase() === selectedLocality.toLowerCase()) return false;
        const d = Math.hypot(p.latitude - centroidLat, p.longitude - centroidLng);
        return d <= 0.05;
      });
      candidateSpots = [...candidateSpots, ...otherSpots];
    }

    if (candidateSpots.length === 0) {
      alert("No spots available near this area to build a plan.");
      return;
    }

    const freeSpots = candidateSpots.filter((p) => p.priceRange === "Free" || p.tags.includes("free"));
    const paidSpots = candidateSpots.filter((p) => p.priceRange !== "Free" && !p.tags.includes("free"));

    const targetCount = areaTimeBudget === "1" ? 2 : areaTimeBudget === "5" ? 4 : 3;
    const planStops: Place[] = [];

    const sortedFree = [...freeSpots].sort((a, b) => b.rating - a.rating);
    const sortedPaid = [...paidSpots].sort((a, b) => b.rating - a.rating);

    for (let i = 0; i < targetCount; i++) {
      if (i % 2 === 0) {
        if (sortedFree.length > 0) {
          planStops.push(sortedFree.shift()!);
        } else if (sortedPaid.length > 0) {
          planStops.push(sortedPaid.shift()!);
        }
      } else {
        if (sortedPaid.length > 0) {
          planStops.push(sortedPaid.shift()!);
        } else if (sortedFree.length > 0) {
          planStops.push(sortedFree.shift()!);
        }
      }
    }

    if (planStops.length === 0) {
      alert("Unable to generate plan. Please try another area.");
      return;
    }

    let minCost = 0;
    let maxCost = 0;
    planStops.forEach((p) => {
      if (p.priceRange === "$$") {
        minCost += 200;
        maxCost += 500;
      } else if (p.priceRange === "$$$") {
        minCost += 500;
        maxCost += 1200;
      } else if (p.priceRange === "$") {
        minCost += 50;
        maxCost += 150;
      }
    });

    const budgetText = minCost === 0 ? "Free Entrance Only" : `₹${minCost} - ₹${maxCost} per person`;
    setAreaPlanStops(planStops);
    setAreaPlanBudgetEstimate(budgetText);
  };

  const handleLaunchAreaPlan = () => {
    if (!areaPlanStops || areaPlanStops.length === 0) return;
    const stopIds = areaPlanStops.map((s) => s.id).join(",");
    const trailName = `${selectedLocality} ${areaTimeBudget === "1" ? "1-Hour" : areaTimeBudget === "5" ? "5-Hour" : "3-Hour"} Plan`;
    router.push(`/map?mode=trip&stops=${encodeURIComponent(stopIds)}&sourceName=${encodeURIComponent(areaPlanStops[0].title)}&destName=${encodeURIComponent(areaPlanStops[areaPlanStops.length - 1].title)}&trailName=${encodeURIComponent(trailName)}`);
  };

  const handleGenerateLocalOuting = async () => {
    if (allPlaces.length === 0) {
      alert("No places available in this city to plan an outing.");
      return;
    }
    setOutingGenerating(true);
    setOutingStops(null);
    setLiveEventSuggestions([]);
    setHangoutSuggestions([]);

    try {
      const targetCount = outingTimeOfDay === "full" ? 4 : 3;

      const cityPlaces = allPlaces.filter(
        (p) => p.city.toLowerCase() === activeCity.toLowerCase()
      );

      if (cityPlaces.length === 0) {
        alert("No places found for the active city.");
        setOutingGenerating(false);
        return;
      }

      let filterFn = (p: Place) => true;
      if (outingVibe === "food") {
        filterFn = (p: Place) => ["restaurant", "food-stall", "street-food", "dessert", "ice-cream"].includes(p.category);
      } else if (outingVibe === "cafe") {
        filterFn = (p: Place) => ["cafe", "dessert", "ice-cream"].includes(p.category);
      } else if (outingVibe === "culture") {
        filterFn = (p: Place) => p.tags.some(t => ["cultural", "heritage", "museum", "scenic", "nature", "park", "tourist-friendly"].includes(t.toLowerCase())) || p.category === "event";
      } else if (outingVibe === "nightlife") {
        filterFn = (p: Place) => ["bar", "nightlife"].includes(p.category) || p.tags.some(t => ["night-drive", "late-night"].includes(t.toLowerCase()));
      }

      let candidates = cityPlaces.filter(filterFn);
      if (candidates.length < targetCount) {
        candidates = [...cityPlaces];
      }

      if (outingType === "family") {
        const familyFriendly = candidates.filter(p => p.tags.some(t => ["family-friendly", "family", "kids", "kids-friendly"].includes(t.toLowerCase())));
        if (familyFriendly.length >= targetCount) candidates = familyFriendly;
      } else if (outingType === "date") {
        const romantic = candidates.filter(p => p.rating >= 4.4 || p.tags.some(t => ["romantic", "cozy", "scenic", "view"].includes(t.toLowerCase())));
        if (romantic.length >= targetCount) candidates = romantic;
      } else if (outingType === "friends") {
        const groupSpots = candidates.filter(p => p.tags.some(t => ["group", "friends", "casual", "hangout"].includes(t.toLowerCase())));
        if (groupSpots.length >= targetCount) candidates = groupSpots;
      }

      candidates.sort(() => 0.5 - Math.random());

      const chosenStops: Place[] = [];
      const usedCategories = new Set<string>();

      for (const p of candidates) {
        if (chosenStops.length >= targetCount) break;
        if (candidates.length >= targetCount * 2 && usedCategories.has(p.category)) {
          continue;
        }
        chosenStops.push(p);
        usedCategories.add(p.category);
      }

      if (chosenStops.length < targetCount) {
        const remaining = candidates.filter(p => !chosenStops.some(s => s.id === p.id));
        for (const p of remaining) {
          if (chosenStops.length >= targetCount) break;
          chosenStops.push(p);
        }
      }

      chosenStops.sort((a, b) => {
        const score = (category: string) => {
          if (["cafe", "dessert"].includes(category)) return 1;
          if (["event", "street-food", "food-stall"].includes(category)) return 2;
          if (["restaurant"].includes(category)) return 3;
          if (["bar", "nightlife"].includes(category)) return 4;
          return 5;
        };
        return score(a.category) - score(b.category);
      });

      const typeLabel = outingType === "friends" ? "Friends Outing" : outingType === "date" ? "Date Night Outing" : outingType === "family" ? "Family Outing" : "Solo Outing";
      const vibeLabel = outingVibe === "food" ? "Foodie Trail" : outingVibe === "cafe" ? "Cafe Hop" : outingVibe === "culture" ? "Heritage & Arts" : "Nightlife Crawl";
      const name = `${vibeLabel} for a ${typeLabel} (${outingTimeOfDay === "full" ? "Full Day" : outingTimeOfDay === "morning" ? "Day Out" : "Evening Out"})`;
      setOutingStops(chosenStops);
      setOutingPreviewName(name);

      try {
        const eventsRes = await fetch(`/api/events/live?city=${encodeURIComponent(activeCity)}`);
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          const eventsList: LiveEvent[] = eventsData.events ?? [];
          const matchedEvents = eventsList.filter(evt => {
            if (outingTimeOfDay === "evening") {
              const hour = parseInt(evt.time.split(":")[0]);
              if (isNaN(hour) || hour < 16) return false;
            }
            if (outingVibe === "nightlife") {
              return ["music", "nightlife", "comedy"].includes(evt.category);
            }
            if (outingVibe === "culture") {
              return ["cultural", "theatre", "workshop"].includes(evt.category);
            }
            return true;
          });
          setLiveEventSuggestions(matchedEvents.slice(0, 2));
        }

        const hangoutsRes = await fetch(`/api/hangouts?city=${encodeURIComponent(activeCity)}`);
        if (hangoutsRes.ok) {
          const hangoutsData = await hangoutsRes.json();
          const hangoutsList = hangoutsData.hangouts ?? [];
          const stopsLocalities = chosenStops.map(s => s.locality.toLowerCase());
          const matchedHangouts = hangoutsList.filter((h: any) => {
            return stopsLocalities.some(loc => h.placeTitle.toLowerCase().includes(loc) || h.description.toLowerCase().includes(loc));
          });
          setHangoutSuggestions(matchedHangouts.slice(0, 2));
        }
      } catch (err) {
        console.warn("Failed to fetch live suggestions for outing planner:", err);
      }

    } catch (e) {
      console.error(e);
      alert("Something went wrong generating the outing.");
    } finally {
      setOutingGenerating(false);
    }
  };

  const handleLaunchOuting = () => {
    if (!outingStops || outingStops.length === 0) return;
    const stopIds = outingStops.map((s) => s.id).join(",");
    router.push(`/map?mode=trip&stops=${encodeURIComponent(stopIds)}&sourceName=${encodeURIComponent(outingStops[0].title)}&destName=${encodeURIComponent(outingStops[outingStops.length - 1].title)}&trailName=${encodeURIComponent(outingPreviewName)}`);
  };

  const handleSaveOuting = async () => {
    if (!outingStops || outingStops.length === 0) return;
    if (!user) {
      alert("Please log in to save your outings!");
      router.push("/profile");
      return;
    }

    try {
      const routePathCoords: { latitude: number; longitude: number }[] = [];
      outingStops.forEach((s) => {
        routePathCoords.push({ latitude: s.latitude, longitude: s.longitude });
      });

      const payload = {
        name: outingPreviewName,
        source: outingStops[0].locality || activeCity,
        destination: outingStops[outingStops.length - 1].locality || activeCity,
        distanceKm: outingTimeOfDay === "full" ? 6 : 3,
        durationMinutes: outingTimeOfDay === "full" ? 180 : 90,
        routePath: routePathCoords,
        stops: outingStops,
      };

      const saveRes = await fetch("/api/trip-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (saveRes.ok) {
        const data = await saveRes.json();
        if (data.plan?.id) {
          alert("🎉 Outing successfully saved to your profile!");
          router.push(`/trip/${data.plan.id}`);
        } else {
          alert("Saved, but failed to retrieve itinerary ID.");
        }
      } else {
        alert("Failed to save outing plan.");
      }
    } catch (error) {
      console.error("Failed to save outing:", error);
      alert("Error saving your outing.");
    }
  };
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
    <div className="w-full max-w-full min-h-screen overflow-x-hidden">
      <section className="w-full max-w-screen-xl mx-auto grid gap-5 px-3 py-4 sm:px-4 md:min-h-[calc(100vh-5rem)] lg:grid-cols-[minmax(0,1fr)_380px] md:grid-cols-[minmax(0,1fr)_320px] md:px-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-5 pt-3 md:gap-6 md:pt-0 w-full min-w-0"
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
            
            <div className="mt-3">
              <WeatherWidget weather={weather} city={activeCity} />
            </div>

            <MoodPicker value={selectedMood} onChange={setSelectedMood} className="mt-3" />
            <div className="mt-3 flex flex-col gap-2">
              <SmartSearchBar
                value={query}
                onChange={setQuery}
                places={allPlaces}
                placeholder={`Search cafes, food, events in ${activeCity}…`}
                onSelectPlace={(place) => setSelectedPlace(place)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVegOnly(!vegOnly)}
                  className={`inline-flex h-9 w-fit shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-2 font-black transition text-xs border ${
                    vegOnly
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full border transition-all duration-300 ${vegOnly ? "bg-emerald-400 border-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-slate-500 border-slate-650"}`} />
                  Pure Veg Only
                </button>

                <WanderlustDrop
                  places={allPlaces}
                  userLocation={locationSource === "browser" && location ? { latitude: location.latitude, longitude: location.longitude } : null}
                  cityName={activeCity}
                />
              </div>
            </div>

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
              { label: "Total Spots", value: allPlaces.length.toString() },
              { label: "Top Picks", value: allPlaces.filter((place) => place.isTrending).length.toString() },
              { label: "Near You", value: nearbyPlaces.length.toString() },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-2 sm:p-4 text-center sm:text-left">
                <p className="text-xl font-black text-[var(--foreground)] sm:text-2xl">{stat.value}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] sm:text-xs sm:tracking-[0.14em] truncate">{stat.label}</p>
              </div>
            ))}
          </div>

          <Link
            href="/trips"
            className="flex items-center justify-between rounded-xl border border-teal-500/25 bg-gradient-to-r from-teal-500/5 via-cyan-500/5 to-transparent px-4 py-3 sm:px-5 sm:py-4 transition-all duration-300 hover:-translate-y-1 hover:border-teal-400/50 hover:from-teal-500/10 hover:to-cyan-500/10 hover:shadow-[0_8px_30px_rgba(20,184,166,0.12)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                <Sparkles size={18} className="animate-pulse" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-black text-[var(--foreground)]">Twin-City Route Planner 🔀</p>
                <p className="text-[10px] sm:text-xs font-semibold text-[var(--muted)] truncate">Itinerary builder for Hubli-Dharwad, Pune-PCMC, Bangalore-Mysore...</p>
              </div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-teal-400" />
          </Link>

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
          className="flex flex-col gap-5 w-full min-w-0"
        >
          {featuredPlace ? (
            <button
              type="button"
              onClick={() => setSelectedPlace(featuredPlace)}
              className="group relative min-h-[250px] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)] text-left shadow-2xl sm:min-h-[360px] md:min-h-[380px]"
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
                  <h2 className="line-clamp-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{featuredPlace.title}</h2>
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
            <div className="grid min-h-[250px] w-full place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center shadow-2xl sm:min-h-[360px] md:min-h-[380px]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">OpenStreetMap</p>
                <h2 className="mt-2 text-2xl font-black text-[var(--foreground)]">Search a city or place</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Try Bangalore cafes, beach sunrise in Chennai, or events in Delhi.
                </p>
              </div>
            </div>
          )}

          <OutingPlannerTabs
            allPlaces={allPlaces}
            activeCity={activeCity}
            location={location}
            user={user}
            setSelectedPlace={setSelectedPlace}
          />
        </motion.aside>
      </section>

      <section className="w-full max-w-screen-xl mx-auto px-3 pb-12 sm:px-4 md:px-6 md:pb-16">
        {weatherRecommendations.length > 0 && !query && activeFilter === "all" && (
          <DiscoverySection
            title={`Weather Vibe: ${weather.condition} Match`}
            description={`Spots in ${activeCity} that perfectly fit today's ${weather.label.toLowerCase()} weather.`}
            places={weatherRecommendations}
            loading={livePlacesLoading && !usingLivePlaces}
            onPlaceClick={setSelectedPlace}
            onSavePlace={toggleSave}
            savedPlaceIds={savedPlaceIds}
            vibeScores={vibeScores}
          />
        )}

        {/* Live time-of-day Vibe Radar Scanner dashboard */}
        <VibeRadar
          places={allPlaces}
          activeCity={activeCity}
          onPlaceClick={setSelectedPlace}
          className="mb-8"
        />

        {selectedMood && (
          <DiscoverySection
            title={`Picked for your ${getMoodLabel(selectedMood).toLowerCase()} mood`}
            description={`Places in ${activeCity} matched to how you're feeling right now.`}
            places={moodPicks}
            loading={livePlacesLoading && !usingLivePlaces}
            onPlaceClick={setSelectedPlace}
            onSavePlace={toggleSave}
            savedPlaceIds={savedPlaceIds}
            vibeScores={vibeScores}
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
          vibeScores={vibeScores}
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
              vibeScores={vibeScores}
            />

            <DiscoverySection
              title="Family Outings & Favorites"
              description="Highly rated, welcoming spots perfect for family gatherings, kids, and large groups."
              places={allPlaces.filter((place) =>
                place.tags.some(tag => ["family-friendly", "family"].includes(tag))
              ).slice(0, 8)}
              loading={livePlacesLoading && !usingLivePlaces}
              onPlaceClick={setSelectedPlace}
              onSavePlace={toggleSave}
              savedPlaceIds={savedPlaceIds}
              vibeScores={vibeScores}
            />

            <DiscoverySection
              title="Pet-Friendly Hangouts"
              description="Welcoming cafes and open-air spots in the city that love your furry companions as much as you do."
              places={allPlaces.filter((place) =>
                place.tags.some(tag => ["pet-friendly"].includes(tag))
              ).slice(0, 8)}
              loading={livePlacesLoading && !usingLivePlaces}
              onPlaceClick={setSelectedPlace}
              onSavePlace={toggleSave}
              savedPlaceIds={savedPlaceIds}
              vibeScores={vibeScores}
            />

            <DiscoverySection
              title="Visitor & Foreigner Favorites"
              description="Top heritage points, cultural landmarks, and authentic experiences perfect for international travelers and tourists."
              places={allPlaces.filter((place) =>
                place.tags.some(tag => ["foreigner-friendly", "tourist-friendly", "heritage", "cultural"].includes(tag))
              ).slice(0, 8)}
              loading={livePlacesLoading && !usingLivePlaces}
              onPlaceClick={setSelectedPlace}
              onSavePlace={toggleSave}
              savedPlaceIds={savedPlaceIds}
              vibeScores={vibeScores}
            />

            {iceCreamPlaces.length > 0 && (
              <div className="my-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
                <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center md:p-5">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">
                      <IceCreamCone size={14} />
                      Dessert lane
                    </div>
                    <h2 className="mt-3 text-xl font-black tracking-tight text-[var(--foreground)] sm:text-2xl">
                      Scoop runs worth leaving home for
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                      A richer ice cream edit for {activeCity}, from kulfi and natural fruit flavors to gelato and late-night sundaes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveFilter("ice-cream")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-black text-[var(--primary-foreground)] transition hover:opacity-90"
                  >
                    Show only ice cream
                    <ChevronRight size={17} />
                  </button>
                </div>
                <div className="grid grid-cols-2 border-t border-[var(--border)] sm:grid-cols-4">
                  {[
                    { label: "Scoop spots", value: iceCreamPlaces.length.toString() },
                    { label: "Trending", value: iceCreamPlaces.filter((place) => place.isTrending).length.toString() },
                    { label: "Areas", value: iceCreamLocalities.length.toString() },
                    { label: "Closest", value: iceCreamPlaces[0] ? formatDistance(iceCreamPlaces[0].distance) : "Soon" },
                  ].map((stat) => (
                    <div key={stat.label} className="border-r border-[var(--border)] p-3 last:border-r-0 sm:p-4">
                      <p className="text-lg font-black text-[var(--foreground)]">{stat.value}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{stat.label}</p>
                    </div>
                  ))}
                </div>
                {iceCreamLocalities.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-3 md:px-5">
                    {iceCreamLocalities.map((locality) => (
                      <span key={locality} className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs font-bold text-[var(--muted-strong)]">
                        {locality}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DiscoverySection
              title="Ice Cream Specials"
              description={`Gelato, kulfi, sundaes, and late-night scoop shops in ${activeCity}.`}
              places={iceCreamPlaces.slice(0, 12)}
              loading={livePlacesLoading && !usingLivePlaces}
              onPlaceClick={setSelectedPlace}
              onSavePlace={toggleSave}
              savedPlaceIds={savedPlaceIds}
              carousel
              vibeScores={vibeScores}
            />

            {influencerPlaces.length > 0 && (
              <DiscoverySection
                title="Creator & Blogger Favorites"
                description={`Top-recommended local spots in ${activeCity} verified by popular food bloggers and creators.`}
                places={influencerPlaces}
                loading={livePlacesLoading && !usingLivePlaces}
                onPlaceClick={setSelectedPlace}
                onSavePlace={toggleSave}
                savedPlaceIds={savedPlaceIds}
                carousel
                vibeScores={vibeScores}
              />
            )}

            {trailPlaces.length > 0 && (
              <DiscoverySection
                title="Local Walking Trails & Food Crawls"
                description={`Curated multi-stop walking paths in ${activeCity} for ultimate local discoveries.`}
                places={trailPlaces}
                loading={livePlacesLoading && !usingLivePlaces}
                onPlaceClick={setSelectedPlace}
                onSavePlace={toggleSave}
                savedPlaceIds={savedPlaceIds}
                carousel
                vibeScores={vibeScores}
              />
            )}
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
          {/* Confetti Particle Burst Container */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
            {confetti.map((c) => (
              <span
                key={c.id}
                className="confetti-piece"
                style={{
                  left: `${c.left}%`,
                  backgroundColor: c.color,
                  animationDelay: `${c.delay}s`,
                }}
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 text-center shadow-2xl z-40"
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
            <div className="relative my-6 flex min-h-24 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--input)] p-4 shadow-inner">
              {isSpinning && (
                <>
                  <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[var(--input)] to-transparent pointer-events-none z-10" />
                  <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-[var(--input)] to-transparent pointer-events-none z-10" />
                </>
              )}

              <div className="flex flex-col items-center justify-center w-full">
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
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-2 px-4 w-full"
                  >
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
                        {getCategoryLabel(surprisedPlace.category)}
                      </span>
                      {surprisedPlace.rating && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-black text-yellow-400 border border-yellow-500/25">
                          ★ {surprisedPlace.rating}
                        </span>
                      )}
                      {surprisedPlace.priceRange && (
                        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-black text-slate-300 border border-white/5">
                          {surprisedPlace.priceRange}
                        </span>
                      )}
                    </div>
                    <span className="text-xl font-black tracking-tight text-[var(--foreground)] text-center line-clamp-1">
                      {surprisedPlace.title}
                    </span>
                    <span className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1 justify-center">
                      <MapPin size={13} className="text-cyan-400 shrink-0" />
                      <span>{surprisedPlace.locality} · {formatDistance(surprisedPlace.distance)} away</span>
                    </span>
                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed text-center mt-1 px-2 font-medium">
                      {surprisedPlace.description}
                    </p>
                  </motion.div>
                ) : null}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col gap-2">
              {!isSpinning && surprisedPlace ? (
                <>
                  {/* Time Budget Selector */}
                  <div className="mb-3 text-left">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 text-center sm:text-left">
                      Select Available Time
                    </label>
                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1">
                      {[
                        { id: "1", label: "1 Hour", desc: "2 stops" },
                        { id: "3", label: "2-3 Hours", desc: "3 stops" },
                        { id: "5", label: "5+ Hours", desc: "4 stops" },
                      ].map((t) => {
                        const active = timeBudget === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTimeBudget(t.id as any)}
                            className={`flex flex-col items-center justify-center rounded-lg py-1.5 px-1 transition duration-200 cursor-pointer ${
                              active
                                ? "bg-teal-400 text-slate-950 shadow-md font-black"
                                : "text-slate-400 hover:text-white font-semibold"
                            }`}
                          >
                            <span className="text-xs">{t.label}</span>
                            <span className={`text-[9px] ${active ? "text-slate-800" : "text-slate-500"}`}>{t.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSurpriseOpen(false);
                      setSelectedPlace(surprisedPlace);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] py-3 font-black text-[var(--primary-foreground)] transition hover:opacity-90 active:scale-98"
                  >
                    Reveal Details
                    <Compass size={18} />
                  </button>
                  <button
                    type="button"
                    disabled={trailGenerating}
                    onClick={() => handleGenerateTrail(surprisedPlace)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 py-3 font-black text-slate-950 transition hover:opacity-95 disabled:opacity-50 active:scale-98"
                  >
                    {trailGenerating ? "Generating Trail..." : "Generate Spontaneous Trail 🗺️"}
                  </button>
                  <button
                    type="button"
                    onClick={triggerSurpriseMe}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] py-3 font-black text-[var(--foreground)] transition hover:bg-[var(--panel)] active:scale-98"
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
