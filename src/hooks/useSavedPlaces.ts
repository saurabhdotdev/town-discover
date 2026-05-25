"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Place } from "@/types";

export const useSavedPlaces = () => {
  const { user, setAuthRequiredMessage } = useAuth();
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      return;
    }

    const controller = new AbortController();

    fetch("/api/saved-places", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load saved places.");
        setSavedPlaceIds(new Set(data.placeIds ?? []));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSavedPlaceIds(new Set());
        }
      });

    return () => controller.abort();
  }, [user]);

  const toggleSave = useCallback(
    async (place: Place) => {
      if (!user) {
        const message = "Please log in to save places.";
        setAuthRequiredMessage(message);
        window.location.href = "/profile";
        return;
      }

      const isSaved = savedPlaceIds.has(place.id);
      setSavedPlaceIds((current) => {
        const next = new Set(current);
        if (isSaved) {
          next.delete(place.id);
        } else {
          next.add(place.id);
        }
        return next;
      });

      try {
        const response = await fetch(isSaved ? `/api/saved-places?placeId=${encodeURIComponent(place.id)}` : "/api/saved-places", {
          method: isSaved ? "DELETE" : "POST",
          headers: isSaved ? undefined : { "Content-Type": "application/json" },
          body: isSaved ? undefined : JSON.stringify({ placeId: place.id }),
        });

        if (!response.ok) {
          throw new Error("Unable to update saved place.");
        }
      } catch {
        setSavedPlaceIds((current) => {
          const next = new Set(current);
          if (isSaved) {
            next.add(place.id);
          } else {
            next.delete(place.id);
          }
          return next;
        });
      }
    },
    [savedPlaceIds, setAuthRequiredMessage, user]
  );

  return { savedPlaceIds: user ? savedPlaceIds : new Set<string>(), toggleSave };
};
