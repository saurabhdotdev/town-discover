"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Place } from "@/types";

// Global module-level state for useSavedPlaces
let globalSavedPlaceIds: Set<string> | null = null;
let globalSavedPlaces: Place[] | null = null;
let globalLoadingPlaces = false;
const savedPlacesListeners = new Set<() => void>();

const updateSavedPlacesState = (ids: Set<string>, places: Place[], loading: boolean) => {
  globalSavedPlaceIds = ids;
  globalSavedPlaces = places;
  globalLoadingPlaces = loading;
  savedPlacesListeners.forEach((listener) => listener());
};

export const useSavedPlaces = () => {
  const { user, setAuthRequiredMessage } = useAuth();
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(
    globalSavedPlaceIds ?? new Set()
  );
  const [savedPlaces, setSavedPlaces] = useState<Place[]>(
    globalSavedPlaces ?? []
  );
  const [loadingPlaces, setLoadingPlaces] = useState<boolean>(
    globalLoadingPlaces
  );

  useEffect(() => {
    const handleUpdate = () => {
      setSavedPlaceIds(globalSavedPlaceIds ?? new Set());
      setSavedPlaces(globalSavedPlaces ?? []);
      setLoadingPlaces(globalLoadingPlaces);
    };

    savedPlacesListeners.add(handleUpdate);

    if (!user) {
      updateSavedPlacesState(new Set(), [], false);
      savedPlacesListeners.delete(handleUpdate);
      return () => {
        savedPlacesListeners.delete(handleUpdate);
      };
    }

    // Only fetch if not already loaded globally
    if (globalSavedPlaceIds === null) {
      const controller = new AbortController();
      updateSavedPlacesState(new Set(), [], true);

      fetch("/api/saved-places", {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Unable to load saved places.");
          const ids = data.placeIds ?? [];
          const allIds = data.allPlaceIds ?? ids;

          if (allIds.length > 0) {
            fetch(`/api/places/resolve?ids=${encodeURIComponent(allIds.join(","))}`, {
              signal: controller.signal,
            })
              .then(async (res) => {
                const resData = await res.json();
                if (res.ok && !controller.signal.aborted) {
                  updateSavedPlacesState(new Set(ids), resData.places ?? [], false);
                } else {
                  updateSavedPlacesState(new Set(), [], false);
                }
              })
              .catch(() => {
                updateSavedPlacesState(new Set(), [], false);
              });
          } else {
            updateSavedPlacesState(new Set(), [], false);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            updateSavedPlacesState(new Set(), [], false);
          }
        });

      return () => {
        controller.abort();
        savedPlacesListeners.delete(handleUpdate);
      };
    }

    return () => {
      savedPlacesListeners.delete(handleUpdate);
    };
  }, [user]);

  const toggleSave = useCallback(
    async (place: Place) => {
      if (!user) {
        const message = "Please log in to save places.";
        setAuthRequiredMessage(message);
        window.location.href = "/profile";
        return;
      }

      const currentIds = globalSavedPlaceIds ?? savedPlaceIds;
      const currentPlaces = globalSavedPlaces ?? savedPlaces;
      const isSaved = currentIds.has(place.id);
      
      // Optimistic updates (Global)
      const nextIds = new Set(currentIds);
      let nextPlaces = [...currentPlaces];
      if (isSaved) {
        nextIds.delete(place.id);
        nextPlaces = nextPlaces.filter((p) => p.id !== place.id);
      } else {
        nextIds.add(place.id);
        nextPlaces.push(place);
      }
      updateSavedPlacesState(nextIds, nextPlaces, false);

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
        // Rollback on failure (Global)
        const rollbackIds = new Set(nextIds);
        let rollbackPlaces = [...nextPlaces];
        if (isSaved) {
          rollbackIds.add(place.id);
          rollbackPlaces.push(place);
        } else {
          rollbackIds.delete(place.id);
          rollbackPlaces = rollbackPlaces.filter((p) => p.id !== place.id);
        }
        updateSavedPlacesState(rollbackIds, rollbackPlaces, false);
      }
    },
    [savedPlaceIds, savedPlaces, setAuthRequiredMessage, user]
  );

  return {
    savedPlaceIds: user ? savedPlaceIds : new Set<string>(),
    savedPlaces: user ? savedPlaces : [],
    loadingPlaces,
    toggleSave,
  };
};
