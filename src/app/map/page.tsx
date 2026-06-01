"use client";

import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/common/Header";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { LocationPermissionCard } from "@/components/common/LocationPermissionCard";
import dynamic from "next/dynamic";
import { useCitySelection } from "@/hooks/useCitySelection";
import { useLivePlacesByBounds } from "@/hooks/useLivePlacesByBounds";
import { useGeolocation } from "@/hooks/useGeolocation";
import { MOCK_PLACES, getPlacesWithDistance } from "@/data/mock-places";
import { getFallbackPlacesForCity } from "@/lib/client/fallback-places";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { Place } from "@/types";
import { MapSkeleton } from "@/components/common/Skeleton";

const MapView = dynamic(() => import("@/components/map/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => <MapSkeleton />
});
import { Clock, LocateFixed, Map, MapPin, Star, Play, Pause, Square, FastForward, Navigation, ShieldAlert, CheckCircle2 } from "lucide-react";
import { cn, formatDistance, getCategoryLabel, isOpenNow } from "@/lib/utils";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import { combineLiveAndCuratedPlaces } from "@/lib/combine-places";
import { CITY_CENTERS } from "@/lib/pune-location";
import { SuggestPlaceModal } from "@/components/map/SuggestPlaceModal";
import { geocodePlace, generateStopsAlongRoute, ROUTE_PRESETS } from "@/lib/client/trip-utils";
import { calculateDistance } from "@/lib/geo";

export default function MapPage() {
  const { selectedCity, hasChosenCity, chooseCity, preferDetectedCity } = useCitySelection();
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const {
    location,
    loading: locationLoading,
    error: locationError,
    source: locationSource,
    city: detectedCity,
    requestLocation,
  } = useGeolocation();
  const activeCity = !hasChosenCity && locationSource === "browser" ? detectedCity : selectedCity;
  const activeLocation =
    locationSource === "browser" && location && activeCity === detectedCity ? location : CITY_CENTERS[activeCity];
  
  const [mapBounds, setMapBounds] = useState<{ south: number; west: number; north: number; east: number } | null>(null);

  const { places: livePlaces, loading: livePlacesLoading, error: livePlacesError } = useLivePlacesByBounds(
    mapBounds,
    activeCity
  );
  const [focusedPlace, setFocusedPlace] = useState<Place | null>(null);
  const [detailsPlace, setDetailsPlace] = useState<Place | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showOnlyOpen, setShowOnlyOpen] = useState<boolean>(false);
  const [minRating, setMinRating] = useState<number>(0);
  const { savedPlaceIds, savedPlaces } = useSavedPlaces();

  // Sheher Trip Planner States
  const [mode, setMode] = useState<"explore" | "trip">("explore");
  const [tripSource, setTripSource] = useState<string>("Pune");
  const [tripDest, setTripDest] = useState<string>("Mumbai");
  const [tripRoutePath, setTripRoutePath] = useState<{ latitude: number; longitude: number }[] | null>(null);
  const [tripStops, setTripStops] = useState<Place[]>([]);
  const [selectedTripCategory, setSelectedTripCategory] = useState<"all" | "food" | "ev" | "toilet" | "scenic">("all");
  const [tripLoading, setTripLoading] = useState<boolean>(false);
  const [tripError, setTripError] = useState<string | null>(null);
  const [tripStats, setTripStats] = useState<{ distance: number; duration: number } | null>(null);

  // Cruise Simulation States
  const [simulationActive, setSimulationActive] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(2); // 2x default
  const [simulationIndex, setSimulationIndex] = useState<number>(0);
  const [upcomingStopAlert, setUpcomingStopAlert] = useState<{ place: Place; distance: number } | null>(null);

  const handlePlanTrip = async (startStr: string, endStr: string) => {
    if (!startStr.trim() || !endStr.trim()) {
      setTripError("Please fill in starting point and destination.");
      return;
    }
    setTripLoading(true);
    setTripError(null);
    setSimulationActive(false);
    setSimulationIndex(0);
    setFocusedPlace(null);
    
    try {
      const startCoord = await geocodePlace(startStr);
      const endCoord = await geocodePlace(endStr);
      
      if (!startCoord || !endCoord) {
        throw new Error("Unable to resolve locations. Try another spelling.");
      }

      const url = `https://router.project-osrm.org/route/v1/driving/${startCoord.longitude},${startCoord.latitude};${endCoord.longitude},${endCoord.latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("OSRM routing server connection error.");
      
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates) {
        throw new Error("No driving route found between these locations.");
      }

      const coords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng
      }));

      setTripRoutePath(coords);
      setTripStats({
        distance: Math.round(data.routes[0].distance / 1000),
        duration: Math.round(data.routes[0].duration / 60)
      });

      const stops = generateStopsAlongRoute(startCoord.name, endCoord.name, coords);
      setTripStops(stops);
    } catch (err: any) {
      setTripError(err.message || "An unexpected error occurred during route calculation.");
    } finally {
      setTripLoading(false);
    }
  };

  const simStepSize = useMemo(() => {
    if (!tripRoutePath) return 1;
    return Math.max(1, Math.floor(tripRoutePath.length / 150));
  }, [tripRoutePath]);

  useEffect(() => {
    if (!simulationActive || !tripRoutePath) return;
    if (simulationIndex >= tripRoutePath.length - 1) {
      setSimulationActive(false);
      return;
    }

    const intervalTime = Math.max(40, Math.floor(500 / simulationSpeed));
    const timer = setTimeout(() => {
      setSimulationIndex(prev => {
        const next = prev + simStepSize;
        return next >= tripRoutePath.length ? tripRoutePath.length - 1 : next;
      });
    }, intervalTime);

    return () => clearTimeout(timer);
  }, [simulationActive, simulationIndex, simulationSpeed, tripRoutePath, simStepSize]);

  const currentSimCoord = useMemo(() => {
    if (!tripRoutePath || !simulationActive) return null;
    return tripRoutePath[simulationIndex] || null;
  }, [tripRoutePath, simulationIndex, simulationActive]);

  useEffect(() => {
    if (!currentSimCoord || !tripStops.length) {
      setUpcomingStopAlert(null);
      return;
    }

    let nearest: Place | null = null;
    let minD = 3.0;

    tripStops.forEach(stop => {
      const dist = calculateDistance(
        currentSimCoord.latitude,
        currentSimCoord.longitude,
        stop.latitude,
        stop.longitude
      );
      if (dist < minD) {
        minD = dist;
        nearest = stop;
      }
    });

    if (nearest) {
      setUpcomingStopAlert({
        place: nearest,
        distance: minD
      });
    } else {
      setUpcomingStopAlert(null);
    }
  }, [currentSimCoord, tripStops]);

  const filteredTripStops = useMemo(() => {
    return tripStops.filter(stop => {
      if (selectedTripCategory === "all") return true;
      if (selectedTripCategory === "food") {
        return stop.tags.includes("food-stall") || stop.tags.includes("local-food") || stop.tags.includes("food-plaza") || stop.category === "restaurant" || stop.category === "cafe";
      }
      if (selectedTripCategory === "ev") {
        return stop.tags.includes("ev-station");
      }
      if (selectedTripCategory === "toilet") {
        return stop.tags.includes("toilet") || stop.tags.includes("restroom");
      }
      if (selectedTripCategory === "scenic") {
        return stop.tags.includes("viewpoint") || stop.tags.includes("scenic");
      }
      return true;
    });
  }, [tripStops, selectedTripCategory]);

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

  const allPlaces = useMemo(() => {
    const combined = combineLiveAndCuratedPlaces(livePlaces, curatedPlaces);

    // Add saved places (mock and live) that belong to this city to ensure they show up on the map
    const combinedIds = new Set(combined.map((p) => p.id));
    const extraSaved: Place[] = [];

    savedPlaces.forEach((place) => {
      if (
        place.city.toLowerCase() === activeCity.toLowerCase() &&
        !combinedIds.has(place.id)
      ) {
        extraSaved.push(place);
      }
    });

    return getPlacesWithDistance([...combined, ...extraSaved], activeLocation);
  }, [activeLocation, curatedPlaces, livePlaces, savedPlaces, activeCity]);

  const filteredPlaces = useMemo(() => {
    return allPlaces.filter((place) => {
      if (selectedCategory === "saved") {
        if (!savedPlaceIds.has(place.id)) return false;
      } else if (selectedCategory === "night-drive") {
        if (!place.tags.includes("night-drive")) return false;
      } else if (selectedCategory !== "all" && place.category !== selectedCategory) {
        return false;
      }
      if (showOnlyOpen && !isOpenNow(place.hours)) return false;
      if (minRating > 0 && place.rating < minRating) return false;
      return true;
    });
  }, [allPlaces, selectedCategory, showOnlyOpen, minRating, savedPlaceIds]);

  const sortedPlaces = useMemo(() => [...filteredPlaces].sort((a, b) => a.distance - b.distance), [filteredPlaces]);
  const locationLabel =
    locationSource === "browser" && activeCity === detectedCity
      ? `Near you in ${activeCity}`
      : usingLivePlaces
        ? `Live + curated ${activeCity} places`
        : `Curated ${activeCity} places`;

  const categories = useMemo(() => {
    const citySavedCount = allPlaces.filter((p) => savedPlaceIds.has(p.id)).length;
    return [
      { value: "all", label: "All Spots" },
      ...(citySavedCount > 0 ? [{ value: "saved", label: "❤ Favorites" }] : []),
      { value: "night-drive", label: "Night Drives" },
      { value: "cafe", label: "Cafes" },
      { value: "restaurant", label: "Restaurants" },
      { value: "event", label: "Events" },
      { value: "nightlife", label: "Nightlife" },
      { value: "food-stall", label: "Food Stalls" },
      { value: "bar", label: "Bars" },
      { value: "dessert", label: "Desserts" },
      { value: "street-food", label: "Street Food" },
    ];
  }, [allPlaces, savedPlaceIds]);

  return (
    <div className="min-h-screen">
      <Header
        eyebrow="Map"
        title="Map View"
        location={locationLabel}
      />

      <div className="mx-auto grid max-w-screen-xl gap-4 px-3 py-4 sm:px-4 md:px-6 md:py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="lg:col-span-2">
          <div className="flex flex-col gap-3">
            <CitySwitcher
              value={activeCity}
              onChange={(city) => {
                chooseCity(city);
                setFocusedPlace(null);
                setDetailsPlace(null);
              }}
            />

            {/* Horizontal Filter Chips */}
            <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-[var(--panel-soft)] p-3 rounded-lg border border-[var(--border)]">
              <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                {categories.map((cat) => {
                  const active = selectedCategory === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.value);
                        setFocusedPlace(null);
                      }}
                      className={cn(
                        "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-black transition-all border cursor-pointer",
                        active
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)] shadow-sm"
                          : "bg-[var(--panel)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--panel-strong)] hover:text-[var(--foreground)]"
                      )}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowOnlyOpen(!showOnlyOpen);
                    setFocusedPlace(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black border transition-all cursor-pointer",
                    showOnlyOpen
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : "bg-[var(--panel)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--panel-strong)]"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", showOnlyOpen ? "bg-emerald-300 animate-pulse" : "bg-slate-500")} />
                  Open Now
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMinRating(minRating === 0 ? 4.5 : 0);
                    setFocusedPlace(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black border transition-all cursor-pointer",
                    minRating > 0
                      ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
                      : "bg-[var(--panel)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--panel-strong)]"
                  )}
                >
                  <Star size={12} className={cn("shrink-0", minRating > 0 ? "fill-yellow-300 text-yellow-300" : "text-slate-500")} />
                  Top Rated (4.5★+)
                </button>
              </div>
            </div>
          </div>

          <LocationPermissionCard
            source={locationSource}
            loading={locationLoading}
            error={locationError}
            onRequest={() => {
              preferDetectedCity();
              requestLocation();
            }}
          />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
          className={`relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] lg:h-[calc(100vh-11rem)] ${mobileView === "list" ? "h-0 hidden lg:block" : "h-[60vh] min-h-[320px] sm:h-[58vh]"}`}
        >
          <button
            type="button"
            onClick={() => setIsSuggestModalOpen(true)}
            className="absolute top-4 left-4 z-[500] flex items-center gap-2 rounded-full border border-teal-500/30 bg-slate-950/90 px-4 py-2.5 text-xs font-black tracking-wider uppercase text-teal-400 shadow-xl backdrop-blur-md transition-all hover:bg-slate-900 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span className="flex h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
            + Add Spot
          </button>

          {livePlacesLoading && !usingLivePlaces && mode !== "trip" ? (
            <MapSkeleton />
          ) : (
            <MapView
              places={mode === "trip" ? tripStops : sortedPlaces}
              userLocation={activeLocation}
              selectedPlace={focusedPlace}
              onMarkerClick={setFocusedPlace}
              onCenterChange={setMapCenter}
              onBoundsChange={setMapBounds}
              className="h-full min-h-full rounded-lg border-0"
              tripMode={mode === "trip"}
              tripRoutePath={mode === "trip" ? tripRoutePath : null}
              simulationActive={simulationActive}
              simulationCoord={currentSimCoord}
            />
          )}

          {/* Simulation Cruise Upcoming Stop Toast Alert */}
          {mode === "trip" && upcomingStopAlert && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-16 left-4 right-4 z-[500] flex items-center gap-3.5 rounded-xl border border-cyan-400/40 bg-slate-950/92 px-4 py-3 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-4 sm:max-w-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
                <Navigation size={18} className="animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                  Upcoming in {upcomingStopAlert.distance.toFixed(1)} km
                </p>
                <h4 className="mt-0.5 line-clamp-1 text-xs font-black text-white">
                  {upcomingStopAlert.place.title}
                </h4>
                <p className="line-clamp-1 text-[10px] text-slate-300/80">
                  {upcomingStopAlert.place.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFocusedPlace(upcomingStopAlert.place);
                  setDetailsPlace(upcomingStopAlert.place);
                }}
                className="shrink-0 rounded-lg bg-cyan-400 px-3 py-1.5 text-[10px] font-black text-slate-950 hover:bg-cyan-300 active:scale-95 transition cursor-pointer"
              >
                Inspect
              </button>
            </motion.div>
          )}

          {focusedPlace && (
            <div className="absolute inset-x-2 bottom-2 z-[500] rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-2xl backdrop-blur-xl sm:inset-x-3 sm:bottom-3 sm:p-4 lg:hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-200">
                    {getCategoryLabel(focusedPlace.category, focusedPlace.tags)}
                  </p>
                  <h2 className="mt-1 line-clamp-1 text-base font-black text-[var(--foreground)] sm:text-lg">{focusedPlace.title}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{focusedPlace.locality}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFocusedPlace(null)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-black text-[var(--muted-strong)]"
                >
                  Close
                </button>
              </div>
              <button type="button" onClick={() => setDetailsPlace(focusedPlace)} className="mt-3 w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-black text-[var(--primary-foreground)]">
                View Details
              </button>
            </div>
          )}
        </motion.div>

        {/* Mobile Map/List toggle FAB */}
        <div className="fixed bottom-4 left-4 z-[600] lg:hidden" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
          <button
            type="button"
            onClick={() => setMobileView(mobileView === "map" ? "list" : "map")}
            className="flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-black text-[var(--primary-foreground)] shadow-2xl shadow-black/30 transition active:scale-95"
          >
            {mobileView === "map" ? (
              <><MapPin size={16} /> List</>
            ) : (
              <><Map size={16} /> Map</>
            )}
          </button>
        </div>

        <aside className={`space-y-3 ${mobileView === "map" ? "hidden lg:block" : "block"}`}>
          {/* Mode Switcher Tabs */}
          <div className="flex p-1 rounded-full bg-[var(--panel-soft)] border border-[var(--border)] w-full">
            <button
              type="button"
              onClick={() => setMode("explore")}
              className={cn(
                "flex-1 text-center py-2 text-xs font-black uppercase tracking-wider rounded-full transition-all cursor-pointer",
                mode === "explore"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              📍 Explore Spots
            </button>
            <button
              type="button"
              onClick={() => setMode("trip")}
              className={cn(
                "flex-1 text-center py-2 text-xs font-black uppercase tracking-wider rounded-full transition-all cursor-pointer",
                mode === "trip"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              🚗 Plan a Trip
            </button>
          </div>

          {mode === "explore" ? (
            <>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-black text-[var(--foreground)]">Nearby Places</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">Sorted by distance from the active location.</p>
                    {livePlacesError && (
                      <p className="mt-2 text-xs font-semibold text-rose-200">
                        {livePlacesError}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    title={locationSource === "browser" ? "Using your location" : "Use my location"}
                    onClick={() => {
                      preferDetectedCity();
                      requestLocation();
                    }}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-lg transition-all",
                      locationSource === "browser"
                        ? "bg-teal-300 text-slate-950 shadow-lg shadow-teal-400/30"
                        : "bg-[var(--panel)] text-[var(--muted-strong)] border border-[var(--border)] hover:bg-teal-300/20 hover:text-teal-300 hover:border-teal-400/40",
                      locationLoading && "animate-pulse"
                    )}
                  >
                    <LocateFixed size={19} className={locationLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 pr-0 lg:max-h-[calc(100vh-21rem)] lg:overflow-y-auto lg:pr-1">
                {sortedPlaces.map((place) => {
                  const active = focusedPlace?.id === place.id;
                  const open = isOpenNow(place.hours);
                  const hasHours = Boolean(place.hours);

                  return (
                    <div
                      key={place.id}
                      className={`w-full rounded-lg border p-3 text-left transition sm:p-4 ${active
                          ? "border-teal-300/70 bg-teal-300/10"
                          : "border-[var(--border)] bg-[var(--panel-soft)] hover:bg-[var(--panel)]"
                        }`}
                    >
                      <button type="button" onClick={() => setFocusedPlace(place)} className="w-full text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                              {getCategoryLabel(place.category, place.tags)}
                            </p>
                            <h3 className="mt-1 line-clamp-1 font-black text-[var(--foreground)]">{place.title}</h3>
                            <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">{place.locality}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-black ${hasHours ? (open ? "bg-emerald-300 text-slate-950" : "bg-rose-500 text-white") : "bg-slate-700 text-slate-200"}`}>
                            {!hasHours ? "Unknown" : open ? "Open" : "Closed"}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-1.5 text-xs font-bold text-[var(--muted-strong)] sm:gap-2">
                          <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-[var(--panel-soft)] px-2 py-2">
                            <MapPin size={13} className="shrink-0 text-cyan-300" />
                            <span className="truncate">{formatDistance(place.distance)}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--panel-soft)] px-2 py-2">
                            <Star size={13} className="fill-yellow-300 text-yellow-300" />
                            {place.rating}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--panel-soft)] px-2 py-2">
                            <Clock size={13} className="text-[var(--muted)]" />
                            {place.priceRange ?? "Varies"}
                          </span>
                        </div>
                      </button>

                      {active && (
                        <button
                          type="button"
                          onClick={() => setDetailsPlace(place)}
                          className="mt-3 w-full rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-black text-[var(--primary-foreground)]"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* SHEHER TRIP PLANNER CONTROLS */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 space-y-4 shadow-xl">
                <div>
                  <h2 className="font-black text-[var(--foreground)] text-base">Plan a Trip</h2>
                  <p className="text-xs text-[var(--muted)] mt-0.5">Plot a route & discover essential stops along the way.</p>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] block mb-1">Source (A)</label>
                    <input
                      type="text"
                      value={tripSource}
                      onChange={(e) => setTripSource(e.target.value)}
                      placeholder="e.g. Pune"
                      className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] block mb-1">Destination (B)</label>
                    <input
                      type="text"
                      value={tripDest}
                      onChange={(e) => setTripDest(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handlePlanTrip(tripSource, tripDest)}
                  disabled={tripLoading}
                  className="w-full bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-black uppercase tracking-widest py-3 rounded-lg hover:scale-[1.01] active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {tripLoading ? "Calculating Route..." : "🗺️ Get Route & Stops"}
                </button>

                {tripError && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                    <ShieldAlert size={14} className="shrink-0" />
                    <span>{tripError}</span>
                  </div>
                )}

                {/* Popular Route Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] block">Iconic Highway Presets</span>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-fade-right">
                    {Object.entries(ROUTE_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setTripSource(preset.start.name);
                          setTripDest(preset.end.name);
                          handlePlanTrip(preset.start.name, preset.end.name);
                        }}
                        className="shrink-0 bg-[var(--panel-soft)] border border-[var(--border)] text-[var(--muted-strong)] text-[10px] font-bold px-2.5 py-1.5 rounded-full hover:bg-[var(--panel-strong)] hover:text-[var(--foreground)] transition cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ROUTE STATS & CONTROLS HUD */}
              {tripRoutePath && tripStats && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-cyan-400/20 bg-cyan-950/10 p-4 space-y-3.5 shadow-lg backdrop-blur-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300/80">Distance</span>
                        <div className="text-xl font-black text-[var(--foreground)] mt-0.5">{tripStats.distance} km</div>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300/80">Est. Time</span>
                        <div className="text-xl font-black text-[var(--foreground)] mt-0.5">
                          {Math.floor(tripStats.duration / 60)}h {tripStats.duration % 60}m
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-cyan-400/10 pt-3 flex items-center justify-between gap-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                        ⚡ Cruise Simulation
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (simulationIndex >= tripRoutePath.length - 1) {
                              setSimulationIndex(0);
                            }
                            setSimulationActive(!simulationActive);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-slate-950 hover:bg-cyan-300 active:scale-90 transition cursor-pointer"
                          title={simulationActive ? "Pause Journey" : "Start Cruise"}
                        >
                          {simulationActive ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                        </button>

                        {simulationIndex > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSimulationActive(false);
                              setSimulationIndex(0);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-90 transition cursor-pointer"
                            title="Reset Journey"
                          >
                            <Square size={12} fill="currentColor" />
                          </button>
                        )}
                        
                        {simulationActive && (
                          <button
                            type="button"
                            onClick={() => {
                              setSimulationSpeed(prev => prev === 2 ? 5 : prev === 5 ? 10 : 2);
                            }}
                            className="flex h-8 px-2.5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-black text-cyan-300 hover:bg-slate-700 transition cursor-pointer"
                            title="Adjust Cruise Speed"
                          >
                            <FastForward size={11} className="mr-1" />
                            {simulationSpeed}x
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-cyan-400 h-full transition-all duration-300"
                          style={{ width: `${(simulationIndex / (tripRoutePath.length - 1)) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] font-bold text-[var(--muted)]">
                        <span>START</span>
                        <span>{Math.round((simulationIndex / (tripRoutePath.length - 1)) * 100)}% COMPLETE</span>
                        <span>END</span>
                      </div>
                    </div>
                  </div>

                  {/* STOPS FILTER CHIPS */}
                  <div className="flex gap-1 overflow-x-auto no-scrollbar scroll-fade-right bg-[var(--panel-soft)] p-2 rounded-lg border border-[var(--border)]">
                    {[
                      { id: "all", label: "All Stops" },
                      { id: "food", label: "🍔 Eateries" },
                      { id: "ev", label: "⚡ EV Charging" },
                      { id: "toilet", label: "🚻 Restrooms" },
                      { id: "scenic", label: "📸 Scenic Stops" }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedTripCategory(cat.id as any)}
                        className={cn(
                          "shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all",
                          selectedTripCategory === cat.id
                            ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)] shadow-sm"
                            : "bg-[var(--panel)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--panel-strong)]"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* STOPS LIST FEED */}
                  <div className="space-y-3 max-h-[calc(100vh-29rem)] overflow-y-auto pr-1 no-scrollbar">
                    {filteredTripStops.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-[var(--border)] rounded-lg bg-[var(--panel-soft)]">
                        <p className="text-xs text-[var(--muted)] font-medium">No pitstops matching filter on this route.</p>
                      </div>
                    ) : (
                      filteredTripStops.map(stop => {
                        const isFocused = focusedPlace?.id === stop.id;
                        return (
                          <div
                            key={stop.id}
                            className={cn(
                              "w-full rounded-lg border p-3 text-left transition",
                              isFocused
                                ? "border-cyan-400 bg-cyan-400/5 shadow-md animate-pulse"
                                : "border-[var(--border)] bg-[var(--panel-soft)] hover:bg-[var(--panel)]"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setFocusedPlace(stop);
                                setMapCenter({ latitude: stop.latitude, longitude: stop.longitude });
                              }}
                              className="w-full text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                                    {getCategoryLabel(stop.category, stop.tags)}
                                  </p>
                                  <h3 className="mt-1 line-clamp-1 font-black text-[var(--foreground)] text-sm">{stop.title}</h3>
                                  <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">{stop.locality}</p>
                                </div>
                                <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-500/20">
                                  ★ {stop.rating}
                                </span>
                              </div>

                              <p className="mt-2 text-xs text-[var(--muted-strong)] line-clamp-2 leading-relaxed">
                                {stop.description}
                              </p>

                              <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-[var(--muted-strong)] border-t border-[var(--border)] pt-2.5">
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={11} className="text-cyan-300" />
                                  <span>{stop.locality.split(",")[0]}</span>
                                </span>
                                <span className="font-black text-cyan-400 uppercase tracking-wider">
                                  {stop.priceRange}
                                </span>
                              </div>
                            </button>

                            {isFocused && (
                              <button
                                type="button"
                                onClick={() => setDetailsPlace(stop)}
                                className="mt-3 w-full rounded-lg bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300 transition active:scale-[0.98] cursor-pointer"
                              >
                                View Detailed Info
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <PlaceDetailModal place={detailsPlace} onClose={() => setDetailsPlace(null)} />
      <SuggestPlaceModal
        isOpen={isSuggestModalOpen}
        onClose={() => setIsSuggestModalOpen(false)}
        defaultCity={activeCity}
        defaultCoords={mapCenter || { latitude: activeLocation.latitude, longitude: activeLocation.longitude }}
      />
    </div>
  );
}
