import { Place, UserLocation } from "@/types";
import { SupportedCityName } from "@/lib/pune-location";
import { formatPlaceArea, isUsefulArea } from "@/lib/utils";

const parseLocalityFromAddress = (address: string, city: string): string => {
  const parts = address
    .split(",")
    .map((part) => part.replace(/\b\d{5,6}\b/g, "").trim())
    .filter(Boolean)
    .filter((part) => {
      const normalized = part.toLowerCase();
      return (
        normalized !== "india" &&
        !normalized.includes("maharashtra") &&
        !normalized.includes("karnataka") &&
        !normalized.includes("delhi") &&
        !normalized.includes("tamil nadu") &&
        !normalized.includes("uttar pradesh")
      );
    });

  const locality =
    parts.find((part) => part.toLowerCase() !== city.toLowerCase() && isUsefulArea(part)) ||
    parts[0] ||
    "";

  return formatPlaceArea({ locality, city });
};

export async function fetchGooglePlaces(
  query: string,
  city: SupportedCityName,
  location?: UserLocation
): Promise<Place[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const textQuery = query.trim()
    ? `${query} in ${city}`
    : `top cafes and famous restaurants in ${city}`;

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.editorialSummary,places.photos,places.nationalPhoneNumber,places.websiteUri",
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "en",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Google Places API error:", errText);
    throw new Error(`Google Places search failed: ${response.statusText}`);
  }

  const data = await response.json();
  const rawPlaces = data.places ?? [];

  return rawPlaces.map((p: any): Place => {
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    
    let category: Place["category"] = "restaurant";
    const types = p.types ?? [];
    if (types.includes("cafe") || types.includes("coffee_shop")) {
      category = "cafe";
    } else if (types.includes("bar") || types.includes("pub")) {
      category = "bar";
    } else if (types.includes("night_club")) {
      category = "nightlife";
    } else if (types.includes("bakery") || types.includes("dessert_shop")) {
      category = "dessert";
    } else if (types.includes("tourist_attraction") || types.includes("museum") || types.includes("park") || types.includes("amusement_park")) {
      category = "event";
    }

    const title = p.displayName?.text || "Google Place";
    const placeId = `google-${p.id}`;

    let image = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=420&fit=crop";
    if (p.photos && p.photos.length > 0) {
      image = `/api/places/photo?name=${encodeURIComponent(p.photos[0].name)}`;
    }

    const address = p.formattedAddress || "";
    const locality = parseLocalityFromAddress(address, city);

    return {
      id: placeId,
      title,
      description: p.editorialSummary?.text || `A popular local ${category} located in ${locality}, ${city}.`,
      category,
      image,
      rating: p.rating || 4.2,
      distance: 0,
      latitude: lat,
      longitude: lng,
      tags: types.slice(0, 4).map((t: string) => t.replace(/_/g, "-").toLowerCase()),
      city,
      locality,
      isOpen: true,
      isTrending: (p.rating ?? 0) >= 4.5 && (p.userRatingCount ?? 0) > 100,
      reviewCount: p.userRatingCount || 0,
      priceRange: "$$",
      phone: p.nationalPhoneNumber || undefined,
      website: p.websiteUri || undefined,
      hours: undefined,
    };
  });
}
