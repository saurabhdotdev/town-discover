"use client";

import { useCallback, useEffect, useState } from "react";
import { SupportedCityName } from "@/lib/pune-location";

export type OnboardingInterest =
  | "cafe"
  | "restaurant"
  | "street-food"
  | "nightlife"
  | "bar"
  | "event"
  | "heritage"
  | "hidden-gems";

export interface OnboardingPrefs {
  city: SupportedCityName;
  interests: OnboardingInterest[];
}

const STORAGE_KEY = "sheher-onboarding-v1";

const readPrefs = (): OnboardingPrefs | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingPrefs) : null;
  } catch {
    return null;
  }
};

const writePrefs = (prefs: OnboardingPrefs) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
};

export const clearOnboarding = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
};

export const useOnboarding = () => {
  const [prefs, setPrefs] = useState<OnboardingPrefs | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readPrefs();
    setPrefs(stored);
    setShowOnboarding(!stored);
    setHydrated(true);
  }, []);

  const completeOnboarding = useCallback((incoming: OnboardingPrefs) => {
    writePrefs(incoming);
    setPrefs(incoming);
    setShowOnboarding(false);
  }, []);

  const resetOnboarding = useCallback(() => {
    clearOnboarding();
    setPrefs(null);
    setShowOnboarding(true);
  }, []);

  return { prefs, showOnboarding, hydrated, completeOnboarding, resetOnboarding };
};
