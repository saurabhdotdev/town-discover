import { Place } from "@/types";

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const mergePlaces = (primary: Place[], extra: Place[]) => {
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  const merged: Place[] = [];

  for (const place of [...primary, ...extra]) {
    if (place.id && seenIds.has(place.id)) continue;
    const key = normalizeKey(`${place.city || ""}-${place.title}`);
    if (seenKeys.has(key)) continue;
    
    seenKeys.add(key);
    if (place.id) seenIds.add(place.id);
    merged.push(place);
  }

  return merged;
};
