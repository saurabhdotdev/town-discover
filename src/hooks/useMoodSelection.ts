"use client";

import { useEffect, useState } from "react";
import { MoodAxis } from "@/lib/mood-recommendations";

const STORAGE_KEY = "sheher-selected-mood";

const parseStoredMood = (value: string | null): MoodAxis | null => {
  if (!value) return null;
  const moods: MoodAxis[] = ["chill", "adventurous", "social", "foodie", "romantic", "cultural", "energetic", "budget"];
  return moods.includes(value as MoodAxis) ? (value as MoodAxis) : null;
};

export const useMoodSelection = () => {
  const [selectedMood, setSelectedMood] = useState<MoodAxis | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setSelectedMood(parseStoredMood(window.sessionStorage.getItem(STORAGE_KEY)));
      setHydrated(true);
    }, 0);
  }, []);

  const updateMood = (mood: MoodAxis | null) => {
    setSelectedMood(mood);
    if (mood) {
      window.sessionStorage.setItem(STORAGE_KEY, mood);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  return { selectedMood, setSelectedMood: updateMood, hydrated };
};
