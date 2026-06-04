import { calculateDistance } from "@/lib/geo";
import { resolvePlaceImage } from "@/lib/place-images";
import { getNearestSupportedCity, getSupportedCityLocation, isWithinSupportedCity } from "@/lib/pune-location";
import { formatPlaceArea, isUsefulArea } from "@/lib/utils";
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
  const leisure = tags.leisure;

  if (amenity === "cafe") return "cafe";
  if (amenity === "bar" || amenity === "pub" || amenity === "biergarten") return "bar";
  if (amenity === "nightclub") return "nightlife";
  if (amenity === "ice_cream") return "ice-cream";
  if (amenity === "fast_food" || amenity === "food_court") return "food-stall";
  if (amenity === "restaurant") return "restaurant";
  if (
    amenity === "cinema" ||
    amenity === "theatre" ||
    amenity === "arts_centre" ||
    amenity === "community_centre" ||
    amenity === "marketplace"
  ) {
    return "event";
  }
  if (
    tourism === "museum" ||
    tourism === "gallery" ||
    tourism === "attraction" ||
    tourism === "viewpoint" ||
    tourism === "zoo" ||
    tourism === "theme_park"
  ) return "event";
  if (shop === "bakery" || shop === "confectionery") return "dessert";
  if (leisure === "park" || leisure === "garden" || leisure === "sports_centre" || leisure === "playground") return "event";
  
  const name = (tags.name || "").toLowerCase();
  if (
    name.includes("multiplex") ||
    name.includes("cinema") ||
    name.includes("cineplex") ||
    name.includes("theatre") ||
    name.includes("theater") ||
    name.includes("imax") ||
    name.includes("movies")
  ) {
    return "event";
  }

  return "restaurant";
};

const getLocality = (tags: Record<string, string>): string => {
  const locality =
    tags["addr:suburb"] ||
    tags["addr:neighbourhood"] ||
    tags["addr:quarter"] ||
    tags["addr:city_district"] ||
    tags["addr:borough"] ||
    tags["addr:street"] ||
    "";
  const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || "";

  if (!isUsefulArea(locality) && !isUsefulArea(city)) return "Nearby";

  return formatPlaceArea({ locality, city });
};

const getTags = (tags: Record<string, string>, category: PlaceCategory): string[] => {
  const values = [
    tags.cuisine,
    tags.amenity,
    tags.tourism,
    tags.shop,
    tags.leisure,
    tags["addr:street"],
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

const DESC_TEMPLATES: Record<PlaceCategory, string[]> = {
  cafe: [
    "A cozy spot in {locality}, perfect for catching up over coffee, quick work sessions, or reading a book.",
    "A charming local cafe in {locality}. Stop by for artisanal brews, warm vibes, and a relaxed atmosphere.",
    "A welcoming neighborhood hub in {locality}, ideal for your daily caffeine fix and casual conversations."
  ],
  restaurant: [
    "A popular local dining spot in {locality}, serving fresh {cuisine}flavors and signature regional plates.",
    "A welcoming restaurant in the heart of {locality}, known for its cozy ambiance and delicious {cuisine}cuisine.",
    "An inviting culinary destination in {locality}, perfect for dinner plans, family gatherings, or casual lunches."
  ],
  bar: [
    "A lively local bar in {locality}. Great drinks, smooth tracks, and the perfect spot to start your evening plans.",
    "An energetic neighborhood pub in {locality}, offering a fine selection of pours, pub bites, and high-energy vibes.",
    "Unwind after hours in {locality} at this popular hangout spot, perfect for cocktails and good company."
  ],
  nightlife: [
    "A premier high-energy nightlife venue in {locality}, featuring live music beats, signature mixes, and a packed floor.",
    "Experience the night vibe in {locality} at this lively destination, keeping the city spirit alive until late.",
    "An electric evening club in {locality}, known for its stellar music line-up and unforgettable night scene."
  ],
  event: [
    "A beautiful green space and cultural attraction in {locality}, offering a peaceful outdoor retreat in the city.",
    "A prominent heritage and local landmark in {locality}. Highly recommended for walks, photos, and sightseeing.",
    "Explore local history and leisure at this popular gathering point in {locality}, perfect for weekend afternoons."
  ],
  "food-stall": [
    "A busy local street stall in {locality}, delivering quick bites, fiery spices, and authentic neighborhood street flavors.",
    "A popular street-side counter in {locality}, famous for its fresh local snacks and budget-friendly comfort food.",
    "Grab a quick, delicious bite on the go at this highly-rated local food stall in {locality}."
  ],
  dessert: [
    "Treat yourself to fresh cakes, artisanal pastries, and sweet delicacies at this dessert corner in {locality}.",
    "A delightful sweet spot in {locality}, perfect for satisfying your late-night dessert cravings.",
    "Indulge in sweet treats and local confectionery at this popular neighborhood shop in {locality}."
  ],
  "ice-cream": [
    "Cool off with rich, creamy scoops and fresh fruit flavors at this beloved ice cream parlor in {locality}.",
    "A must-visit ice cream destination in {locality}, serving artisanal flavors, sundaes, and signature cones.",
    "Beat the heat with handcrafted ice creams, gelatos, and frozen delights at this popular spot in {locality}."
  ],
  "street-food": [
    "A vibrant street food vendor in {locality}, serving up hot, delicious local specialties and savory snacks.",
    "Savor the authentic taste of the city's street culture at this popular stall in {locality}.",
    "A local favorite spot in {locality} for quick street eats, fast service, and classic city flavors."
  ]
};

const getCuisineLabel = (tags: Record<string, string>): string => {
  if (!tags.cuisine) return "";
  const first = tags.cuisine.split(";")[0].trim().toLowerCase();
  return toTitle(first) + " ";
};

const getLocalityLabel = (tags: Record<string, string>): string => {
  const loc = getLocality(tags);
  return loc === "Nearby" ? "the neighborhood" : loc;
};

const getLocalDeterministicIndex = (str: string, length: number): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % length;
};

const getDescription = (tags: Record<string, string>, category: PlaceCategory): string => {
  const name = tags.name || "This place";
  if (tags.description) return tags.description;

  const cuisine = getCuisineLabel(tags);
  const locality = getLocalityLabel(tags);

  const templates = DESC_TEMPLATES[category] || DESC_TEMPLATES.event;
  const idx = getLocalDeterministicIndex(name, templates.length);
  const template = templates[idx];

  return template
    .replace("{locality}", locality)
    .replace("{cuisine}", cuisine);
};

const getOpeningHours = (value: string | undefined): Place["hours"] => {
  if (!value) return undefined;
  if (/24\/7/.test(value)) return { open: "00:00", close: "00:00" };

  const match = value.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return undefined;

  const [, openHour, openMinute, closeHour, closeMinute] = match;
  const open = `${openHour.padStart(2, "0")}:${openMinute}`;
  const close = `${closeHour.padStart(2, "0")}:${closeMinute}`;

  return { open, close };
};

const getSyntheticRating = (distance: number, tags: Record<string, string>): number => {
  const tagBoost = tags.website || tags.phone || tags.opening_hours ? 0.2 : 0;
  const distanceBoost = Math.max(0, 0.35 - distance * 0.06);
  return Math.min(4.9, Math.round((4.1 + tagBoost + distanceBoost) * 10) / 10);
};

const broadContainerPattern = /\b(high street|mall|plaza|complex|business park|it park|tech park|township|society|commercial|market yard)\b/i;
const specificAmenities = new Set([
  "cafe",
  "restaurant",
  "fast_food",
  "food_court",
  "bar",
  "pub",
  "biergarten",
  "nightclub",
  "ice_cream",
  "cinema",
  "theatre",
  "arts_centre",
]);

const isBroadContainerListing = (title: string, tags: Record<string, string>) => {
  const hasSpecificAmenity = Boolean(
    (tags.amenity && specificAmenities.has(tags.amenity)) ||
      tags.shop === "bakery" ||
      tags.shop === "confectionery" ||
      tags.leisure === "park" ||
      tags.leisure === "garden" ||
      tags.leisure === "sports_centre" ||
      tags.leisure === "playground"
  );
  if (hasSpecificAmenity) return false;

  return broadContainerPattern.test(title) || tags.shop === "mall";
};

const buildOverpassQuery = (location: UserLocation, radiusMeters: number) => `
  [out:json][timeout:25];
  (
    node(around:${radiusMeters},${location.latitude},${location.longitude})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream|cinema|theatre|arts_centre|community_centre|marketplace)$"]["name"];
    way(around:${radiusMeters},${location.latitude},${location.longitude})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream|cinema|theatre|arts_centre|community_centre|marketplace)$"]["name"];
    relation(around:${radiusMeters},${location.latitude},${location.longitude})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream|cinema|theatre|arts_centre|community_centre|marketplace)$"]["name"];
    node(around:${radiusMeters},${location.latitude},${location.longitude})["tourism"~"^(museum|gallery|attraction|viewpoint|zoo|theme_park)$"]["name"];
    way(around:${radiusMeters},${location.latitude},${location.longitude})["tourism"~"^(museum|gallery|attraction|viewpoint|zoo|theme_park)$"]["name"];
    relation(around:${radiusMeters},${location.latitude},${location.longitude})["tourism"~"^(museum|gallery|attraction|viewpoint|zoo|theme_park)$"]["name"];
    node(around:${radiusMeters},${location.latitude},${location.longitude})["shop"~"^(bakery|confectionery)$"]["name"];
    way(around:${radiusMeters},${location.latitude},${location.longitude})["shop"~"^(bakery|confectionery)$"]["name"];
    relation(around:${radiusMeters},${location.latitude},${location.longitude})["shop"~"^(bakery|confectionery)$"]["name"];
    node(around:${radiusMeters},${location.latitude},${location.longitude})["leisure"~"^(park|garden|sports_centre|playground)$"]["name"];
    way(around:${radiusMeters},${location.latitude},${location.longitude})["leisure"~"^(park|garden|sports_centre|playground)$"]["name"];
    relation(around:${radiusMeters},${location.latitude},${location.longitude})["leisure"~"^(park|garden|sports_centre|playground)$"]["name"];
  );
  out center tags 180;
`;

const overpassEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

async function fetchOverpassWithTimeout(
  query: string,
  signal?: AbortSignal,
  timeoutMs = 15000
): Promise<Response> {
  let lastError: any = null;

  for (const endpoint of overpassEndpoints) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Link the parent signal if provided
    let onAbort: (() => void) | null = null;
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        onAbort = () => controller.abort();
        signal.addEventListener("abort", onAbort);
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "Sheher/1.0 contact:town-discover.vercel.app",
        },
        signal: controller.signal,
      });

      if (response.ok) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status} from ${endpoint}`);
    } catch (err: any) {
      if (signal?.aborted) {
        throw new Error("Live request was cancelled.");
      }
      lastError = err;
    } finally {
      clearTimeout(timeoutId);
      if (onAbort && signal) {
        signal.removeEventListener("abort", onAbort);
      }
    }
  }

  throw lastError || new Error("All Overpass endpoints failed to respond.");
}

export async function fetchLivePlaces(
  location: UserLocation,
  signal?: AbortSignal,
  radiusMeters = 6000
): Promise<Place[]> {
  const activeLocation = getSupportedCityLocation(location);
  const activeCity = getNearestSupportedCity(activeLocation);
  const query = buildOverpassQuery(activeLocation, radiusMeters);

  let response: Response;
  try {
    response = await fetchOverpassWithTimeout(query, signal);
  } catch {
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
      if (isBroadContainerListing(title, tags)) return null;

      const key = `${title.toLowerCase()}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`;
      if (seen.has(key)) return null;
      seen.add(key);

      const distance = calculateDistance(activeLocation.latitude, activeLocation.longitude, latitude, longitude);
      const category = getCategoryFromTags(tags);
      const placeCity = getNearestSupportedCity({ latitude, longitude }) || activeCity;
      const placeId = `osm-${element.type}-${element.id}`;
      const hasUsefulTags = Boolean(tags.website || tags.phone || tags.opening_hours || tags.cuisine);

      return {
        id: placeId,
        title,
        description: getDescription(tags, category),
        category,
        image: resolvePlaceImage({
          id: placeId,
          title,
          category,
          city: placeCity,
          osmTags: tags,
        }),
        rating: getSyntheticRating(distance, tags),
        distance,
        latitude,
        longitude,
        tags: getTags(tags, category),
        city: placeCity,
        locality: getLocality(tags),
        isOpen: true,
        isTrending: hasUsefulTags && distance < 2,
        reviewCount: 0,
        priceRange: tags.amenity === "restaurant" || tags.amenity === "bar" ? "$$" : "$",
        phone: tags.phone || tags["contact:phone"],
        website: tags.website || tags["contact:website"],
        hours: getOpeningHours(tags.opening_hours),
      } satisfies Place;
    })
    .filter((place): place is Place => Boolean(place));

  return places.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.isTrending !== b.isTrending) return Number(b.isTrending) - Number(a.isTrending);
    return b.rating - a.rating;
  });
}

export async function fetchOSMPlacesByIds(ids: string[], signal?: AbortSignal): Promise<Place[]> {
  const osmIds = ids.filter((id) => id.startsWith("osm-"));
  if (osmIds.length === 0) return [];

  const nodes: string[] = [];
  const ways: string[] = [];
  const relations: string[] = [];

  osmIds.forEach((id) => {
    const parts = id.split("-");
    if (parts.length < 3) return;
    const type = parts[1];
    const rawId = parts[2];
    if (type === "node") nodes.push(rawId);
    else if (type === "way") ways.push(rawId);
    else if (type === "relation") relations.push(rawId);
  });

  let query = "[out:json][timeout:25];(";
  if (nodes.length > 0) query += `node(id:${nodes.join(",")});`;
  if (ways.length > 0) query += `way(id:${ways.join(",")});`;
  if (relations.length > 0) query += `relation(id:${relations.join(",")});`;
  query += ");out center tags;";

  let response: Response;
  try {
    response = await fetchOverpassWithTimeout(query, signal);
  } catch {
    return [];
  }

  const data = (await response.json()) as OverpassResponse;
  const activeCity = "Delhi";

  const places = (data.elements ?? [])
    .map((element): Place | null => {
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;
      const tags = element.tags ?? {};
      const title = tags.name?.trim();

      if (!latitude || !longitude || !title) return null;

      const category = getCategoryFromTags(tags);
      const placeCity = getNearestSupportedCity({ latitude, longitude }) || activeCity;
      const placeId = `osm-${element.type}-${element.id}`;
      const hasUsefulTags = Boolean(tags.website || tags.phone || tags.opening_hours || tags.cuisine);

      return {
        id: placeId,
        title,
        description: getDescription(tags, category),
        category,
        image: resolvePlaceImage({
          id: placeId,
          title,
          category,
          city: placeCity,
          osmTags: tags,
        }),
        rating: getSyntheticRating(0.5, tags),
        distance: 0,
        latitude,
        longitude,
        tags: getTags(tags, category),
        city: placeCity,
        locality: getLocality(tags),
        isOpen: true,
        isTrending: hasUsefulTags,
        reviewCount: 0,
        priceRange: tags.amenity === "restaurant" || tags.amenity === "bar" ? "$$" : "$",
        phone: tags.phone || tags["contact:phone"],
        website: tags.website || tags["contact:website"],
        hours: getOpeningHours(tags.opening_hours),
      } satisfies Place;
    })
    .filter((place): place is Place => Boolean(place));

  return places;
}

const buildBoundsOverpassQuery = (south: number, west: number, north: number, east: number) => `
  [out:json][timeout:25];
  (
    node(around:6000,${(south + north) / 2},${(west + east) / 2})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream|cinema|theatre|arts_centre|community_centre|marketplace)$"]["name"];
    way(around:6000,${(south + north) / 2},${(west + east) / 2})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream|cinema|theatre|arts_centre|community_centre|marketplace)$"]["name"];
    relation(around:6000,${(south + north) / 2},${(west + east) / 2})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream|cinema|theatre|arts_centre|community_centre|marketplace)$"]["name"];
    node(around:6000,${(south + north) / 2},${(west + east) / 2})["tourism"~"^(museum|gallery|attraction|viewpoint|zoo|theme_park)$"]["name"];
    way(around:6000,${(south + north) / 2},${(west + east) / 2})["tourism"~"^(museum|gallery|attraction|viewpoint|zoo|theme_park)$"]["name"];
    relation(around:6000,${(south + north) / 2},${(west + east) / 2})["tourism"~"^(museum|gallery|attraction|viewpoint|zoo|theme_park)$"]["name"];
    node(around:6000,${(south + north) / 2},${(west + east) / 2})["shop"~"^(bakery|confectionery)$"]["name"];
    way(around:6000,${(south + north) / 2},${(west + east) / 2})["shop"~"^(bakery|confectionery)$"]["name"];
    relation(around:6000,${(south + north) / 2},${(west + east) / 2})["shop"~"^(bakery|confectionery)$"]["name"];
    node(around:6000,${(south + north) / 2},${(west + east) / 2})["leisure"~"^(park|garden|sports_centre|playground)$"]["name"];
    way(around:6000,${(south + north) / 2},${(west + east) / 2})["leisure"~"^(park|garden|sports_centre|playground)$"]["name"];
    relation(around:6000,${(south + north) / 2},${(west + east) / 2})["leisure"~"^(park|garden|sports_centre|playground)$"]["name"];
  );
  out center tags 120;
`;

export async function fetchLivePlacesByBounds(
  bounds: { south: number; west: number; north: number; east: number },
  signal?: AbortSignal
): Promise<Place[]> {
  const { south, west, north, east } = bounds;
  
  // We can use a slightly wider bounding box filter, or a radial center query for reliability.
  // Overpass box filters: node(south,west,north,east)["amenity"...]
  const query = `
    [out:json][timeout:25];
    (
      node(${south},${west},${north},${east})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream|cinema|theatre|arts_centre|community_centre|marketplace)$"]["name"];
      way(${south},${west},${north},${east})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream|cinema|theatre|arts_centre|community_centre|marketplace)$"]["name"];
      relation(${south},${west},${north},${east})["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|ice_cream|cinema|theatre|arts_centre|community_centre|marketplace)$"]["name"];
      node(${south},${west},${north},${east})["tourism"~"^(museum|gallery|attraction|viewpoint|zoo|theme_park)$"]["name"];
      way(${south},${west},${north},${east})["tourism"~"^(museum|gallery|attraction|viewpoint|zoo|theme_park)$"]["name"];
      relation(${south},${west},${north},${east})["tourism"~"^(museum|gallery|attraction|viewpoint|zoo|theme_park)$"]["name"];
      node(${south},${west},${north},${east})["shop"~"^(bakery|confectionery)$"]["name"];
      way(${south},${west},${north},${east})["shop"~"^(bakery|confectionery)$"]["name"];
      relation(${south},${west},${north},${east})["shop"~"^(bakery|confectionery)$"]["name"];
      node(${south},${west},${north},${east})["leisure"~"^(park|garden|sports_centre|playground)$"]["name"];
      way(${south},${west},${north},${east})["leisure"~"^(park|garden|sports_centre|playground)$"]["name"];
      relation(${south},${west},${north},${east})["leisure"~"^(park|garden|sports_centre|playground)$"]["name"];
    );
    out center tags 150;
  `;

  let response: Response;
  try {
    response = await fetchOverpassWithTimeout(query, signal);
  } catch {
    throw new Error("Live places by bounds could not be loaded right now.");
  }

  const data = (await response.json()) as OverpassResponse;
  const seen = new Set<string>();
  const activeCity = "Delhi";

  const places = (data.elements ?? [])
    .map((element): Place | null => {
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;
      const tags = element.tags ?? {};
      const title = tags.name?.trim();

      if (!latitude || !longitude || !title) return null;
      if (isBroadContainerListing(title, tags)) return null;

      const key = `${title.toLowerCase()}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`;
      if (seen.has(key)) return null;
      seen.add(key);

      const category = getCategoryFromTags(tags);
      const placeCity = getNearestSupportedCity({ latitude, longitude }) || activeCity;
      const placeId = `osm-${element.type}-${element.id}`;
      const hasUsefulTags = Boolean(tags.website || tags.phone || tags.opening_hours || tags.cuisine);

      return {
        id: placeId,
        title,
        description: getDescription(tags, category),
        category,
        image: resolvePlaceImage({
          id: placeId,
          title,
          category,
          city: placeCity,
          osmTags: tags,
        }),
        rating: getSyntheticRating(0.5, tags),
        distance: 0,
        latitude,
        longitude,
        tags: getTags(tags, category),
        city: placeCity,
        locality: getLocality(tags),
        isOpen: true,
        isTrending: hasUsefulTags,
        reviewCount: 0,
        priceRange: tags.amenity === "restaurant" || tags.amenity === "bar" ? "$$" : "$",
        phone: tags.phone || tags["contact:phone"],
        website: tags.website || tags["contact:website"],
        hours: getOpeningHours(tags.opening_hours),
      } satisfies Place;
    })
    .filter((place): place is Place => Boolean(place));

  return places;
}

