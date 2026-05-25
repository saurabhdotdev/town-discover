"use client";

import { useCallback, useEffect, useState } from "react";
import { getNearestSupportedCity, isWithinSupportedCity, PUNE_CENTER, SupportedCityName } from "@/lib/pune-location";
import { UserLocation } from "@/types";

type LocationSource = "browser" | "fallback";

const supportedCitiesMessage = "Showing Pune, Mumbai, Kolhapur, and Nashik places right now.";

export const useGeolocation = () => {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<LocationSource>("fallback");
  const [city, setCity] = useState<SupportedCityName>("Pune");

  const applyFallbackLocation = useCallback((message: string) => {
    setLocation(PUNE_CENTER);
    setSource("fallback");
    setCity("Pune");
    setError(message);
    setLoading(false);
  }, []);

  const requestLocation = useCallback(() => {
    setLoading(true);

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

        if (!isWithinSupportedCity(browserLocation)) {
          applyFallbackLocation(supportedCitiesMessage);
          return;
        }

        setLocation(browserLocation);
        setSource("browser");
        setCity(getNearestSupportedCity(browserLocation));
        setError(null);
        setLoading(false);
      },
      (positionError) => {
        const message =
          positionError.code === positionError.PERMISSION_DENIED
            ? "Location permission is blocked. Allow location in your browser settings, then tap Use my location."
            : "Location access is unavailable right now. Showing central Pune first.";

        applyFallbackLocation(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 60000,
      }
    );
  }, [applyFallbackLocation]);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      setLocation(PUNE_CENTER);
      setSource("fallback");
      setCity("Pune");
      setError("Location is unavailable while the app is loading. Showing supported city places.");
      setLoading(false);
      return;
    }

    requestLocation();
  }, [requestLocation]);

  const useCityFallback = useCallback((nextCity: SupportedCityName) => {
    setLocation(null);
    setSource("fallback");
    setCity(nextCity);
    setError(null);
    setLoading(false);
  }, []);

  return {
    location,
    error,
    loading,
    isFallback: source === "fallback",
    source,
    city,
    requestLocation,
    useCityFallback,
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
