"use client";

import { useEffect, useState } from "react";
import { Place, UserLocation } from "@/types";

type PlacesResponse = {
  places: Place[];
  source?: "osm" | "fallback";
  warning?: string;
};

export const useLivePlaces = (location: UserLocation | null, query = "") => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      lat: String(location.latitude),
      lng: String(location.longitude),
      query,
    });

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
    });

    fetch(`/api/places/osm?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "OpenStreetMap places could not be loaded.");
        return data as PlacesResponse;
      })
      .then((data) => {
        setPlaces(data.places ?? []);
        console.log(`[Sheher] Loaded ${data.places?.length ?? 0} places. Source: ${data.source}`);

        if (data.source === "fallback") {
          setError(data.warning ?? "Live OpenStreetMap places could not be loaded.");
          return;
        }

        if (data.places.length === 0) {
          setError("No real places were found. Try another city or search term.");
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

    return () => controller.abort();
  }, [location, query]);

  return { places, loading, error };
};
