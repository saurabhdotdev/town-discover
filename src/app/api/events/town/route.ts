import { NextRequest } from "next/server";
import { getAllTownEvents } from "@/data/town-events";
import { fetchLiveTownEvents } from "@/lib/town-events";
import { getCityFromQuery, SUPPORTED_CITY_NAMES } from "@/lib/pune-location";
import { SupportedCityName } from "@/lib/pune-location";
import { createApiHandler } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler({ auth: "none" }, async (request: NextRequest) => {
  const cityParam = request.nextUrl.searchParams.get("city");
  const query = request.nextUrl.searchParams.get("query") ?? "";
  const cityFromQuery = getCityFromQuery(query);
  const city = (cityParam as SupportedCityName | null) ?? cityFromQuery;

  const events = city && SUPPORTED_CITY_NAMES.includes(city) ? await fetchLiveTownEvents(city) : getAllTownEvents();

  return Response.json({
    city: city ?? "all",
    count: events.length,
    events,
    source: "town-script",
  });
});

