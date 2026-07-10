// src/lib/town-events.ts

/**
 * Fetch live town events from Townscript.
 * If the request fails or returns unexpected data, an empty array is returned.
 * The function caches results in-memory for a configurable duration to avoid
 * hammering the external endpoint.
 */
import type { Event } from "@/types/event";
import { getTownEventsForCity } from "@/data/town-events";
import { getCache, setCache } from "@/lib/redis";

export async function fetchLiveTownEvents(city: string): Promise<Event[]> {
  const cacheKey = `events:city:${city.toLowerCase()}`;
  const cached = await getCache<Event[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const base = process.env.TOWNSCRIPT_API_BASE ?? "https://www.townscript.com";
  if (!process.env.TOWNSCRIPT_API_BASE) {
    // No external API configured – return curated list in development
    return getTownEventsForCity(city as any);
  }
  const url = `${base}/api/v2/events?city=${encodeURIComponent(city)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "TownDiscover/1.0 (+https://github.com/your-repo)"
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // Assume the response shape contains an array at json.events
    const events: Event[] = (json.events ?? []).map((e: any) => ({
      id: e.id ?? "",
      title: e.title ?? "",
      description: e.description ?? "",
      image: e.image ?? "",
      rating: e.rating ?? 0,
      latitude: e.latitude ?? 0,
      longitude: e.longitude ?? 0,
      tags: e.tags ?? [],
      locality: e.locality ?? "",
      isOpen: e.isOpen ?? true,
      isTrending: e.isTrending ?? false,
      reviewCount: e.reviewCount ?? 0,
      priceRange: e.priceRange ?? "",
      hours: e.hours ?? { open: "", close: "" },
      city: e.city ?? city,
    }));
    await setCache(cacheKey, events, 600); // 10 minutes
    return events;
  } catch (err) {
    console.error("Failed to fetch live town events:", err);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
