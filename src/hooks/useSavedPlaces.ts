"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Place } from "@/types";

export const useSavedPlaces = () => {
  const { user, setAuthRequiredMessage } = useAuth();
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      setSavedPlaceIds(new Set());
      setSavedPlaces([]);
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
        const ids = data.placeIds ?? [];
        setSavedPlaceIds(new Set(ids));

        if (ids.length > 0) {
          setLoadingPlaces(true);
          fetch(`/api/places/resolve?ids=${encodeURIComponent(ids.join(","))}`, {
            signal: controller.signal,
          })
            .then(async (res) => {
              const resData = await res.json();
              if (res.ok && !controller.signal.aborted) {
                setSavedPlaces(resData.places ?? []);
              }
              if (!controller.signal.aborted) {
                setLoadingPlaces(false);
              }
            })
            .catch(() => {
              if (!controller.signal.aborted) {
                setLoadingPlaces(false);
              }
            });
        } else {
          setSavedPlaces([]);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSavedPlaceIds(new Set());
          setSavedPlaces([]);
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
      
      // Optimistic updates
      setSavedPlaceIds((current) => {
        const next = new Set(current);
        if (isSaved) {
          next.delete(place.id);
        } else {
          next.add(place.id);
        }
        return next;
      });

      setSavedPlaces((current) => {
        if (isSaved) {
          return current.filter((p) => p.id !== place.id);
        } else {
          return [...current, place];
        }
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
        // Rollback on failure
        setSavedPlaceIds((current) => {
          const next = new Set(current);
          if (isSaved) {
            next.add(place.id);
          } else {
            next.delete(place.id);
          }
          return next;
        });

        setSavedPlaces((current) => {
          if (isSaved) {
            return [...current, place];
          } else {
            return current.filter((p) => p.id !== place.id);
          }
        });
      }
    },
    [savedPlaceIds, setAuthRequiredMessage, user]
  );

  return {
    savedPlaceIds: user ? savedPlaceIds : new Set<string>(),
    savedPlaces: user ? savedPlaces : [],
    loadingPlaces,
    toggleSave,
  };
};
