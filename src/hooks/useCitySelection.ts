"use client";

import { useCallback, useEffect, useState } from "react";
import { SUPPORTED_CITY_NAMES, SupportedCityName } from "@/lib/pune-location";

const CITY_STORAGE_KEY = "sheher-selected-city";
const CITY_CHOSEN_KEY = "sheher-city-manually-chosen";

const parseStoredCity = (value: string | null): SupportedCityName | null => {
  if (!value) return null;
  return SUPPORTED_CITY_NAMES.includes(value as SupportedCityName) ? (value as SupportedCityName) : null;
};

const readPersistedCityState = () => {
  if (typeof window === "undefined") {
    return { selectedCity: "Pune" as SupportedCityName, hasChosenCity: false };
  }

  const storedCity = parseStoredCity(window.localStorage.getItem(CITY_STORAGE_KEY));
  const manuallyChosen = window.localStorage.getItem(CITY_CHOSEN_KEY) === "true";

  return {
    selectedCity: storedCity ?? "Pune",
    hasChosenCity: Boolean(manuallyChosen && storedCity),
  };
};

export const useCitySelection = () => {
  const [{ selectedCity, hasChosenCity }, setCityState] = useState(readPersistedCityState);

  // Sync state across multiple instances of the hook in the client
  useEffect(() => {
    const handleCityChanged = (event: Event) => {
      const customEvent = event as CustomEvent<SupportedCityName>;
      if (customEvent.detail && SUPPORTED_CITY_NAMES.includes(customEvent.detail)) {
        setCityState({ selectedCity: customEvent.detail, hasChosenCity: true });
      }
    };

    window.addEventListener("sheher:city-changed", handleCityChanged);
    return () => {
      window.removeEventListener("sheher:city-changed", handleCityChanged);
    };
  }, []);

  const chooseCity = useCallback((city: SupportedCityName) => {
    setCityState({ selectedCity: city, hasChosenCity: true });
    window.localStorage.setItem(CITY_STORAGE_KEY, city);
    window.localStorage.setItem(CITY_CHOSEN_KEY, "true");
    window.dispatchEvent(new CustomEvent("sheher:city-changed", { detail: city }));
  }, []);

  const preferDetectedCity = useCallback(() => {
    setCityState((current) => ({ ...current, hasChosenCity: false }));
    window.localStorage.setItem(CITY_CHOSEN_KEY, "false");
  }, []);

  return {
    selectedCity,
    hasChosenCity,
    chooseCity,
    preferDetectedCity,
  };
};

