"use client";

import { useCallback, useEffect, useState } from "react";
import { getNearestSupportedCity, CITY_CENTERS, PUNE_CENTER, SupportedCityName } from "@/lib/pune-location";
import { calculateDistance } from "@/lib/geo";
import { UserLocation } from "@/types";

type LocationSource = "browser" | "fallback";

const supportedCitiesMessage = "Showing Pune, Mumbai, Kolhapur, Nashik, Bangalore, Chennai, and Delhi places right now.";

// Global module-level state for useGeolocation
let globalLocation: UserLocation | null = null;
let globalSource: LocationSource = "fallback";
let globalCity: SupportedCityName = "Pune";
let globalError: string | null = null;
let globalLoading = true;
let globalHasAttempted = false;
const geoListeners = new Set<() => void>();

const updateGeoState = (
  loc: UserLocation | null,
  src: LocationSource,
  ct: SupportedCityName,
  err: string | null,
  ld: boolean
) => {
  globalLocation = loc;
  globalSource = src;
  globalCity = ct;
  globalError = err;
  globalLoading = ld;
  globalHasAttempted = true;

  if (typeof window !== "undefined" && src === "browser" && loc) {
    try {
      localStorage.setItem("sheher-last-location", JSON.stringify(loc));
      localStorage.setItem("sheher-last-city", ct);
    } catch (e) {
      // ignore
    }
  }

  geoListeners.forEach((l) => l());
};

export const useGeolocation = () => {
  const [location, setLocation] = useState<UserLocation | null>(globalLocation);
  const [error, setError] = useState<string | null>(globalError);
  const [loading, setLoading] = useState(globalLoading);
  const [source, setSource] = useState<LocationSource>(globalSource);
  const [city, setCity] = useState<SupportedCityName>(globalCity);
  const [liveTracking, setLiveTracking] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("sheher-live-tracking") === "true";
    }
    return false;
  });

  // Keep state in sync with global values
  useEffect(() => {
    const handleUpdate = () => {
      setLocation(globalLocation);
      setError(globalError);
      setLoading(globalLoading);
      setSource(globalSource);
      setCity(globalCity);
    };

    geoListeners.add(handleUpdate);
    return () => {
      geoListeners.delete(handleUpdate);
    };
  }, []);

  const applyFallbackLocation = useCallback((message: string) => {
    updateGeoState(PUNE_CENTER, "fallback", "Pune", message, false);
  }, []);

  const handleLocationSuccess = useCallback((browserLocation: UserLocation) => {
    const nearestCity = getNearestSupportedCity(browserLocation);
    const distance = calculateDistance(
      browserLocation.latitude,
      browserLocation.longitude,
      CITY_CENTERS[nearestCity].latitude,
      CITY_CENTERS[nearestCity].longitude
    );

    // If within 100km of the closest supported city, we can use their real location!
    if (distance <= 100) {
      updateGeoState(browserLocation, "browser", nearestCity, null, false);
    } else {
      // Out of bounds - use the nearest city center as the location fallback
      updateGeoState(CITY_CENTERS[nearestCity], "fallback", nearestCity, `Showing closest supported city: ${nearestCity}. (Your location is outside supported bounds)`, false);
    }
  }, []);

  const handleLocationError = useCallback((positionError: any) => {
    const message =
      positionError.code === 1 // PERMISSION_DENIED
        ? "Location permission is blocked. Allow location in your browser settings, then tap Use my location."
        : "Location access is unavailable right now. Showing central Pune first.";

    applyFallbackLocation(message);
  }, [applyFallbackLocation]);

  const requestLocation = useCallback(() => {
    updateGeoState(globalLocation, globalSource, globalCity, globalError, true);

    if (!navigator.geolocation) {
      applyFallbackLocation("Geolocation is not supported by this browser. Showing supported city places.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const browserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        handleLocationSuccess(browserLocation);
      },
      (positionError) => {
        handleLocationError(positionError);
      },
      {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 60000,
      }
    );
  }, [handleLocationSuccess, handleLocationError, applyFallbackLocation]);

  // Handle active watching of location if liveTracking is enabled
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    let watchId: number | null = null;

    if (liveTracking) {
      updateGeoState(globalLocation, globalSource, globalCity, globalError, true);
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const browserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          handleLocationSuccess(browserLocation);
        },
        (positionError) => {
          handleLocationError(positionError);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Force real-time updates without caching
        }
      );
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [liveTracking, handleLocationSuccess, handleLocationError]);

  // Trigger single request on mount if not live tracking
  useEffect(() => {
    if (typeof navigator === "undefined") {
      setTimeout(() => {
        updateGeoState(PUNE_CENTER, "fallback", "Pune", "Location is unavailable while the app is loading. Showing supported city places.", false);
      }, 0);
      return;
    }

    if (!liveTracking && !globalHasAttempted) {
      try {
        const cachedLoc = localStorage.getItem("sheher-last-location");
        const cachedCity = localStorage.getItem("sheher-last-city") as SupportedCityName | null;
        if (cachedLoc && cachedCity) {
          const parsed = JSON.parse(cachedLoc);
          updateGeoState(parsed, "browser", cachedCity, null, false);
        }
      } catch (e) {
        // ignore
      }

      setTimeout(() => {
        requestLocation();
      }, 0);
    } else if (!liveTracking && globalHasAttempted) {
      // If we already resolved location, stop loading spinner immediately
      setLoading(false);
    }
  }, [requestLocation, liveTracking]);

  const useCityFallback = useCallback((nextCity: SupportedCityName) => {
    updateGeoState(null, "fallback", nextCity, null, false);
  }, []);

  const toggleLiveTracking = useCallback(() => {
    setLiveTracking((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("sheher-live-tracking", String(next));
      }
      return next;
    });
  }, []);

  return {
    location,
    error,
    loading,
    isFallback: source === "fallback",
    source,
    city,
    liveTracking,
    requestLocation,
    useCityFallback,
    toggleLiveTracking,
  };
};

export const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      setScrollPosition(window.scrollY);
      setIsScrolling(true);

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  return { scrollPosition, isScrolling };
};

export const useInViewport = (ref: React.RefObject<HTMLElement | null>) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return isVisible;
};
