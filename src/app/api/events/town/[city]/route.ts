import { NextRequest } from 'next/server';
import { getTownEventsForCity, getAllTownEvents } from '@/data/town-events';
import { SupportedCityName } from '@/lib/pune-location';
import { createApiHandler } from '@/lib/server/api-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Helper to map a price range string like '$$', '$$$' to a numeric level.
 */
const priceLevel = (price: string): number => price.length;

export const GET = createApiHandler({ auth: "none" }, async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;

  // Optional city filter – uses the path segment, but also allow query param for backward compatibility
  const cityParam = request.nextUrl.pathname.split('/').pop(); // extracts [city] segment
  const cityFromPath = cityParam && (cityParam as SupportedCityName);
  const cityQuery = searchParams.get('city') as SupportedCityName | null;
  const city = cityFromPath ?? cityQuery;

  // Base events list
  const baseEvents = city ? getTownEventsForCity(city) : getAllTownEvents();

  // Optional tag filter (comma‑separated list)
  const tagsParam = searchParams.get('tags');
  const tagFilters = tagsParam ? tagsParam.split(',').map(t => t.trim().toLowerCase()) : [];

  // Optional price filter (e.g. '$' or '$$')
  const priceParam = searchParams.get('price');

  const filtered = baseEvents.filter(event => {
    // Tags filter – keep if at least one requested tag is present
    if (tagFilters.length) {
      const eventTags = event.tags?.map(t => t.toLowerCase()) || [];
      const hasTag = tagFilters.some(tag => eventTags.includes(tag));
      if (!hasTag) return false;
    }

    // Price filter – keep if event price level matches or is cheaper than requested level
    if (priceParam) {
      const requestedLevel = priceLevel(priceParam);
      const eventLevel = priceLevel(event.priceRange ?? '');
      if (eventLevel > requestedLevel) return false;
    }

    return true;
  });

  return Response.json({
    city: city ?? 'all',
    count: filtered.length,
    events: filtered,
    source: 'town-script',
  });
});

