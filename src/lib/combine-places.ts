import { mergePlaces } from "@/lib/merge-places";
import { Place } from "@/types";

/** Live OSM results plus curated backup — never drop the full city catalog when live data loads. */
export const combineLiveAndCuratedPlaces = (livePlaces: Place[], curatedPlaces: Place[]) => {
  if (!livePlaces.length) return curatedPlaces;
  return mergePlaces(livePlaces, curatedPlaces);
};
