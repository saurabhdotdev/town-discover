"use client";

import { useEffect, useState, useRef } from "react";
import { Place } from "@/types";

type Bounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type PlacesResponse = {
  places: Place[];
  source?: string;
  warning?: string;
};

export const useLivePlacesByBounds = (bounds: Bounds | null, city: string) => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!bounds) return;

    // Debounce bounds changes by 800ms
    const handler = setTimeout(() => {
      // Abort any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        south: String(bounds.south),
        west: String(bounds.west),
        north: String(bounds.north),
        east: String(bounds.east),
        city: city,
      });

      fetch(`/api/places/osm?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error ?? "Visible places could not be loaded.");
          }
          return data as PlacesResponse;
        })
        .then((data) => {
          setPlaces(data.places ?? []);
          console.log(`[Sheher Map] Viewport loaded ${data.places?.length ?? 0} places. Source: ${data.source}`);

          if (data.places.length === 0) {
            setError("No places found in this view. Try panning or zooming out.");
          }
        })
        .catch((caughtError: unknown) => {
          if (controller.signal.aborted) return;
          setPlaces([]);
          setError(caughtError instanceof Error ? caughtError.message : "Live places could not be loaded.");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 800);

    return () => {
      clearTimeout(handler);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [bounds, city]);

  return { places, loading, error };
};
