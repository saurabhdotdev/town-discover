import { Place } from "@/types";

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const mergePlaces = (primary: Place[], extra: Place[]) => {
  const seen = new Set<string>();
  const merged: Place[] = [];

  for (const place of [...primary, ...extra]) {
    const key = normalizeKey(`${place.city}-${place.title}`);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(place);
  }

  return merged;
};
