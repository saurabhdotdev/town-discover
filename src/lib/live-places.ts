import { calculateDistance } from "@/data/mock-places";
import { getNearestSupportedCity, getSupportedCityLocation, isWithinSupportedCity } from "@/lib/pune-location";
import { Place, PlaceCategory, UserLocation } from "@/types";

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

const categoryImages: Record<PlaceCategory, string> = {
  cafe: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=420&fit=crop",
  restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=420&fit=crop",
  event: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&h=420&fit=crop",
  nightlife: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=420&fit=crop",
  "food-stall": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=420&fit=crop",
  bar: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&h=420&fit=crop",
  dessert: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=420&fit=crop",
  "street-food": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&h=420&fit=crop",
};

const toTitle = (value: string): string => {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getCategoryFromTags = (tags: Record<string, string>): PlaceCategory => {
  const amenity = tags.amenity;
  const tourism = tags.tourism;
  const shop = tags.shop;

  if (amenity === "cafe") return "cafe";
  if (amenity === "bar" || amenity === "pub" || amenity === "biergarten") return "bar";
  if (amenity === "nightclub") return "nightlife";
  if (amenity === "ice_cream") return "dessert";
  if (amenity === "fast_food" || amenity === "food_court") return "food-stall";
  if (amenity === "restaurant") return "restaurant";
  if (tourism === "museum" || tourism === "gallery" || tourism === "attraction") return "event";
  if (shop === "bakery" || shop === "confectionery") return "dessert";
  return "restaurant";
};

const getLocality = (tags: Record<string, string>): string => {
  return (
    tags["addr:suburb"] ||
    tags["addr:neighbourhood"] ||
    tags["addr:city"] ||
    tags["addr:street"] ||
    "Nearby"
  );
};

const getTags = (tags: Record<string, string>, category: PlaceCategory): string[] => {
  const values = [
    tags.cuisine,
    tags.amenity,
    tags.tourism,
    tags.shop,
    tags["diet:vegetarian"] === "yes" ? "vegetarian" : undefined,
    tags.outdoor_seating === "yes" ? "outdoor-seating" : undefined,
    tags.internet_access === "wlan" || tags.internet_access === "yes" ? "wifi" : undefined,
    category,
  ];

  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value))
        .flatMap((value) => value.split(";"))
        .map((value) => value.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter(Boolean)
    )
  ).slice(0, 5);
};

const getDescription = (tags: Record<string, string>, category: PlaceCategory): string => {
  const name = tags.name || "This place";
  const cuisine = tags.cuisine ? `${toTitle(tags.cuisine.split(";")[0])} ` : "";
  const categoryLabel = toTitle(category);
  const locality = getLocality(tags);

  if (tags.description) return tags.description;
  if (tags.opening_hours) {
    return `${name} is a live OpenStreetMap ${categoryLabel.toLowerCase()} listing in ${locality}, with mapped opening-hour data.`;
  }
  return `${cuisine}${categoryLabel} found near your current location from live OpenStreetMap data.`;
};

const getSyntheticRating = (distance: number, tags: Record<string, string>): number => {
  const tagBoost = tags.website || tags.phone || tags.opening_hours ? 0.2 : 0;
  const distanceBoost = Math.max(0, 0.35 - distance * 0.06);
  return Math.min(4.9, Math.round((4.1 + tagBoost + distanceBoost) * 10) / 10);
};

const buildOverpassQuery = (location: UserLocation, radiusMeters: number) => `
  [out:json][timeout:18];
  (
    node(around:${radiusMeters},${location.latitude},${location.longitude})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream)$"]["name"];
    way(around:${radiusMeters},${location.latitude},${location.longitude})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream)$"]["name"];
    relation(around:${radiusMeters},${location.latitude},${location.longitude})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream)$"]["name"];
    node(around:${radiusMeters},${location.latitude},${location.longitude})["tourism"~"^(museum|gallery|attraction)$"]["name"];
    way(around:${radiusMeters},${location.latitude},${location.longitude})["tourism"~"^(museum|gallery|attraction)$"]["name"];
    relation(around:${radiusMeters},${location.latitude},${location.longitude})["tourism"~"^(museum|gallery|attraction)$"]["name"];
    node(around:${radiusMeters},${location.latitude},${location.longitude})["shop"~"^(bakery|confectionery)$"]["name"];
    way(around:${radiusMeters},${location.latitude},${location.longitude})["shop"~"^(bakery|confectionery)$"]["name"];
  );
  out center tags 80;
`;

const overpassEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

export async function fetchLivePlaces(
  location: UserLocation,
  signal?: AbortSignal,
  radiusMeters = 2500
): Promise<Place[]> {
  const activeLocation = getSupportedCityLocation(location);
  const activeCity = getNearestSupportedCity(activeLocation);
  const query = buildOverpassQuery(activeLocation, radiusMeters);
  let response: Response | null = null;

  for (const endpoint of overpassEndpoints) {
    try {
      const nextResponse = await fetch(endpoint, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "TownDiscover/1.0 contact:town-discover.vercel.app",
        },
        signal,
      });

      if (nextResponse.ok) {
        response = nextResponse;
        break;
      }
    } catch {
      if (signal?.aborted) throw new Error("Live nearby places request was cancelled.");
    }
  }

  if (!response) {
    throw new Error("Live nearby places could not be loaded right now.");
  }

  const data = (await response.json()) as OverpassResponse;
  const seen = new Set<string>();

  const places = (data.elements ?? [])
    .map((element): Place | null => {
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;
      const tags = element.tags ?? {};
      const title = tags.name?.trim();

      if (!latitude || !longitude || !title) return null;
      if (!isWithinSupportedCity({ latitude, longitude })) return null;

      const key = `${title.toLowerCase()}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`;
      if (seen.has(key)) return null;
      seen.add(key);

      const distance = calculateDistance(activeLocation.latitude, activeLocation.longitude, latitude, longitude);
      const category = getCategoryFromTags(tags);
      const hasUsefulTags = Boolean(tags.website || tags.phone || tags.opening_hours || tags.cuisine);

      return {
        id: `osm-${element.type}-${element.id}`,
        title,
        description: getDescription(tags, category),
        category,
        image: categoryImages[category],
        rating: getSyntheticRating(distance, tags),
        distance,
        latitude,
        longitude,
        tags: getTags(tags, category),
        city: getNearestSupportedCity({ latitude, longitude }) || activeCity,
        locality: getLocality(tags),
        isOpen: true,
        isTrending: hasUsefulTags || distance < 0.6,
        reviewCount: 0,
        priceRange: tags.amenity === "restaurant" || tags.amenity === "bar" ? "$$" : "$",
        phone: tags.phone || tags["contact:phone"],
        website: tags.website || tags["contact:website"],
      } satisfies Place;
    })
    .filter((place): place is Place => Boolean(place));

  return places.sort((a, b) => {
    if (a.isTrending !== b.isTrending) return Number(b.isTrending) - Number(a.isTrending);
    return a.distance - b.distance;
  });
}
