import { NextRequest } from "next/server";
import { getCategoryFallbackImage, PLACE_IMAGE_URLS, WIKIPEDIA_QUERIES_BY_ID } from "@/lib/place-images";
import { fetchWikipediaThumbnailWithFallbacks } from "@/lib/wikipedia-image";
import { SupportedCityName, SUPPORTED_CITY_NAMES } from "@/lib/pune-location";
import { PlaceCategory } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parseCity = (value: string | null): SupportedCityName => {
  return SUPPORTED_CITY_NAMES.includes(value as SupportedCityName) ? (value as SupportedCityName) : "Pune";
};

const parseCategory = (value: string | null): PlaceCategory => {
  const categories: PlaceCategory[] = [
    "cafe",
    "restaurant",
    "event",
    "nightlife",
    "food-stall",
    "bar",
    "dessert",
    "ice-cream",
    "street-food",
  ];
  return categories.includes(value as PlaceCategory) ? (value as PlaceCategory) : "event";
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const placeId = params.get("placeId") ?? "";
  const title = params.get("title") ?? "";
  const city = parseCity(params.get("city"));
  const category = parseCategory(params.get("category"));

  if (placeId && PLACE_IMAGE_URLS[placeId]) {
    return Response.json({ image: PLACE_IMAGE_URLS[placeId], source: "curated" });
  }

  const wikiTitles = [
    ...(placeId && WIKIPEDIA_QUERIES_BY_ID[placeId] ? WIKIPEDIA_QUERIES_BY_ID[placeId] : []),
    title ? `${title}, ${city}` : "",
    title,
  ].filter(Boolean);

  const wikiImage = await fetchWikipediaThumbnailWithFallbacks(wikiTitles);
  if (wikiImage) {
    return Response.json({ image: wikiImage, source: "wikipedia" });
  }

  return Response.json({
    image: getCategoryFallbackImage(city, category, title),
    source: "category-fallback",
  });
}
