import { NextRequest } from "next/server";
import { getAllTownEvents } from "@/data/town-events";import { fetchLiveTownEvents } from "@/lib/town-events";
import { getCityFromQuery } from "@/lib/pune-location";
import { SupportedCityName } from "@/lib/pune-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CITIES: SupportedCityName[] = ["Pune", "Mumbai", "Kolhapur", "Nashik", "Bangalore", "Chennai", "Delhi"];

export async function GET(request: NextRequest) {
  const cityParam = request.nextUrl.searchParams.get("city");
  const query = request.nextUrl.searchParams.get("query") ?? "";
  const cityFromQuery = getCityFromQuery(query);
  const city = (cityParam as SupportedCityName | null) ?? cityFromQuery;

  const events = city && CITIES.includes(city) ? await fetchLiveTownEvents(city) : getAllTownEvents();

  return Response.json({
    city: city ?? "all",
    count: events.length,
    events,
    source: "town-script",
  });
}
