"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/common/Header";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { MapView } from "@/components/map/MapView";
import { useLivePlaces } from "@/hooks/useLivePlaces";
import { useGeolocation } from "@/hooks/useGeolocation";
import { getFallbackPlacesForCity, getPlacesWithDistance } from "@/data/mock-places";
import { Place } from "@/types";
import { MapSkeleton } from "@/components/common/Skeleton";
import { Clock, LocateFixed, MapPin, Star } from "lucide-react";
import { formatDistance, getCategoryLabel, isOpenNow } from "@/lib/utils";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import { CITY_CENTERS, SupportedCityName } from "@/lib/pune-location";

export default function MapPage() {
  const [selectedCity, setSelectedCity] = useState<SupportedCityName>("Pune");
  const [hasChosenCity, setHasChosenCity] = useState(false);
  const { location, source: locationSource, city: detectedCity } = useGeolocation();
  const activeCity = !hasChosenCity && locationSource === "browser" ? detectedCity : selectedCity;
  const activeLocation =
    locationSource === "browser" && location && activeCity === detectedCity ? location : CITY_CENTERS[activeCity];
  const { places: livePlaces, loading: livePlacesLoading, error: livePlacesError } = useLivePlaces(
    activeLocation,
    activeCity
  );
  const [focusedPlace, setFocusedPlace] = useState<Place | null>(null);
  const [detailsPlace, setDetailsPlace] = useState<Place | null>(null);

  const usingLivePlaces = livePlaces.length > 0;
  const fallbackPlaces = useMemo(() => getFallbackPlacesForCity(activeCity), [activeCity]);
  const allPlaces = useMemo(
    () => getPlacesWithDistance(usingLivePlaces ? livePlaces : fallbackPlaces, activeLocation),
    [activeLocation, fallbackPlaces, livePlaces, usingLivePlaces]
  );
  const sortedPlaces = useMemo(() => [...allPlaces].sort((a, b) => a.distance - b.distance), [allPlaces]);
  const locationLabel =
    locationSource === "browser" && activeCity === detectedCity
      ? `Near you in ${activeCity}`
      : usingLivePlaces
        ? `Real ${activeCity} places`
        : `${activeCity} backup places`;

  return (
    <div className="min-h-screen">
      <Header
        eyebrow="Map"
        title="Map View"
        subtitle="Browse supported-city places spatially, then open details from the list or marker."
        location={locationLabel}
      />

      <div className="mx-auto grid max-w-screen-xl gap-4 px-3 py-4 sm:px-4 md:px-6 md:py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="lg:col-span-2">
          <CitySwitcher
            value={activeCity}
            onChange={(city) => {
              setHasChosenCity(true);
              setSelectedCity(city);
              setFocusedPlace(null);
              setDetailsPlace(null);
            }}
          />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
          className="relative h-[52vh] min-h-[340px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] sm:h-[58vh] sm:min-h-[420px] lg:h-[calc(100vh-11rem)]"
        >
          {livePlacesLoading && !usingLivePlaces ? (
            <MapSkeleton />
          ) : (
            <MapView
              places={sortedPlaces}
              userLocation={activeLocation}
              selectedPlace={focusedPlace}
              onMarkerClick={setFocusedPlace}
              className="h-full min-h-full rounded-lg border-0"
            />
          )}

          {focusedPlace && (
            <div className="absolute inset-x-2 bottom-2 z-[500] rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-2xl backdrop-blur-xl sm:inset-x-3 sm:bottom-3 sm:p-4 lg:hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-200">
                    {getCategoryLabel(focusedPlace.category)}
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

        <aside className="space-y-3">
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
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-300 text-slate-950">
                <LocateFixed size={19} />
              </span>
            </div>
          </div>

          <div className="space-y-3 pr-0 lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto lg:pr-1">
            {sortedPlaces.map((place) => {
              const active = focusedPlace?.id === place.id;
              const open = isOpenNow(place.hours);

              return (
                <div
                  key={place.id}
                  className={`w-full rounded-lg border p-3 text-left transition sm:p-4 ${
                    active
                      ? "border-teal-300/70 bg-teal-300/10"
                      : "border-[var(--border)] bg-[var(--panel-soft)] hover:bg-[var(--panel)]"
                  }`}
                >
                  <button type="button" onClick={() => setFocusedPlace(place)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                          {getCategoryLabel(place.category)}
                        </p>
                        <h3 className="mt-1 line-clamp-1 font-black text-[var(--foreground)]">{place.title}</h3>
                        <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">{place.locality}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-black ${open ? "bg-emerald-300 text-slate-950" : "bg-rose-500 text-white"}`}>
                        {open ? "Open" : "Closed"}
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
        </aside>
      </div>

      <PlaceDetailModal place={detailsPlace} onClose={() => setDetailsPlace(null)} />
    </div>
  );
}
