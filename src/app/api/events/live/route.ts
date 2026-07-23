import { NextRequest } from "next/server";
import { getCache, setCache } from "@/lib/redis";
import { SupportedCityName, CITY_CENTERS } from "@/lib/pune-location";
import { getTownEventsForCity } from "@/data/town-events";
import { RateLimitError, serializeError } from "@/lib/server/api-errors";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getClientIp } from "@/lib/server/request-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface LiveEvent {
  id: string;
  title: string;
  description: string;
  category: "music" | "comedy" | "food-festival" | "workshop" | "sports" | "cultural" | "nightlife" | "theatre" | "tech";
  venue: string;
  locality: string;
  city: string;
  date: string; // ISO date string
  time: string; // HH:MM
  endTime?: string;
  price: {
    min: number;
    max: number;
    currency: "INR";
    isFree: boolean;
  };
  image: string;
  tags: string[];
  rating: number;
  isTrending: boolean;
  bookingUrl?: string; // BookMyShow or Paytm Insider deep-link
  artists?: string[]; // performers / speakers
  latitude: number;
  longitude: number;
}

const CITY_CONTEXT: Record<string, { venues: string[]; areas: string[]; lat: number; lng: number }> = {
  Pune: {
    venues: ["Hard Rock Cafe Pune", "High Spirits Cafe", "The Poona Club", "Ness Wadia Hall", "Blue Frog Pune", "Tulja Bhavani Natya Griha", "Deccan Gymkhana", "Harkat Studios", "The Pavillion", "CoEP Amphitheatre"],
    areas: ["Koregaon Park", "Camp", "Baner", "Aundh", "FC Road", "Kothrud", "Viman Nagar", "Hadapsar", "Kalyani Nagar", "Shivajinagar"],
    lat: 18.5204, lng: 73.8567,
  },
  Mumbai: {
    venues: ["Blue Frog", "NCPA", "Prithvi Theatre", "Antioch", "The Habitat", "G5A Foundation", "Bandra Fort Amphitheatre", "Mehboob Studios", "Rangsharda Auditorium", "Hard Rock Cafe Mumbai"],
    areas: ["Bandra", "Lower Parel", "Colaba", "Andheri", "Juhu", "Dadar", "Powai", "Kala Ghoda", "Worli", "BKC"],
    lat: 19.0760, lng: 72.8777,
  },
  Bangalore: {
    venues: ["Hard Rock Cafe Bangalore", "Windmills Craftworks", "Fandom", "Chowdiah Memorial Hall", "Town Hall", "Phoenix Marketcity Courtyard", "Kannada Rajyotsava Hall", "IISc Open Air Theatre", "Bengaluru Gayana Samaja", "The Bflat Bar"],
    areas: ["Indiranagar", "Koramangala", "Whitefield", "MG Road", "Jayanagar", "HSR Layout", "BTM Layout", "Sadashivanagar", "Yelahanka", "Marathahalli"],
    lat: 12.9716, lng: 77.5946,
  },
  Delhi: {
    venues: ["Indira Gandhi Indoor Stadium", "Siri Fort Auditorium", "Lodhi Garden Amphitheatre", "Kingdom of Dreams", "Hard Rock Cafe Delhi", "Summer House Cafe", "Piano Man Jazz Club", "Rashtrapati Bhavan Gardens", "Zorba the Buddha", "TLR"],
    areas: ["Connaught Place", "Hauz Khas", "Lajpat Nagar", "Saket", "Janakpuri", "Dwarka", "Karol Bagh", "Vasant Kunj", "Greater Kailash", "Nehru Place"],
    lat: 28.6139, lng: 77.2090,
  },
  Chennai: {
    venues: ["Music Academy", "Rani Seethai Hall", "The Residency Towers", "Phoenix MarketCity", "Hard Rock Cafe Chennai", "Backyard", "YMCA Ground", "IIT Madras Open Air", "DakshinaChitra", "Ampa Skywalk"],
    areas: ["Anna Nagar", "Adyar", "T. Nagar", "Nungambakkam", "Egmore", "Mylapore", "Velachery", "OMR", "Besant Nagar", "Guindy"],
    lat: 13.0827, lng: 80.2707,
  },
  Kolhapur: {
    venues: ["Shree Mahalaxmi Kala Mandir", "Kala Kendra", "Town Hall", "Rajaram College Grounds", "Sykes Extension Ground", "Mahalaxmi Temple Grounds"],
    areas: ["Shivaji Park", "Mahadwar Road", "Rajaram Puri", "Tarabai Park", "E-Ward", "Old City"],
    lat: 16.705, lng: 74.2433,
  },
  Nashik: {
    venues: ["Tilak Smarak Mandir", "Saraswati Hall", "Gangapur Dam Ground", "NMC Grounds", "Yashwantrao Chavan Natyagriha"],
    areas: ["Gangapur Road", "College Road", "Panchavati", "Sharanpur", "Cidco", "Indira Nagar"],
    lat: 19.9975, lng: 73.7898,
  },
};

const CATEGORY_IMAGES: Record<string, string> = {
  music: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&h=420&fit=crop",
  comedy: "https://images.unsplash.com/photo-1585699324551-f6c309eed262?w=600&h=420&fit=crop",
  "food-festival": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=420&fit=crop",
  workshop: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=420&fit=crop",
  sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&h=420&fit=crop",
  cultural: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&h=420&fit=crop",
  nightlife: "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=600&h=420&fit=crop",
  theatre: "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=600&h=420&fit=crop",
  tech: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&h=420&fit=crop",
};

const liveEventsRateLimit = { max: 60, windowMs: 60_000 };
const refreshEventsRateLimit = { max: 30, windowMs: 60_000 };
const allowedCategories = new Set(["all", ...Object.keys(CATEGORY_IMAGES)]);

const withHeaders = (response: Response, headers: Record<string, string>) => {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
};

function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/, "");
  return cleaned.trim();
}

function getEventImage(category: string): string {
  return CATEGORY_IMAGES[category] ?? "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=420&fit=crop";
}

function formatScrapedEventsDirectly(
  scrapedEvents: ScrapedBmsEvent[],
  city: string,
  cityCtx: typeof CITY_CONTEXT[string]
): LiveEvent[] {
  const today = new Date();
  
  return scrapedEvents.map((item, idx) => {
    const titleLower = item.title.toLowerCase();
    let category: LiveEvent["category"] = "cultural";
    if (titleLower.includes("comedy") || titleLower.includes("standup") || titleLower.includes("stand up") || titleLower.includes("show")) {
      category = "comedy";
    } else if (titleLower.includes("music") || titleLower.includes("concert") || titleLower.includes("live") || titleLower.includes("fest") || titleLower.includes("tour") || titleLower.includes("sunburn") || titleLower.includes("bhajan")) {
      category = "music";
    } else if (titleLower.includes("food") || titleLower.includes("carnival") || titleLower.includes("eat")) {
      category = "food-festival";
    } else if (titleLower.includes("workshop") || titleLower.includes("class") || titleLower.includes("learn") || titleLower.includes("masterclass")) {
      category = "workshop";
    } else if (titleLower.includes("sports") || titleLower.includes("marathon") || titleLower.includes("run") || titleLower.includes("circus") || titleLower.includes("jurassic")) {
      category = "sports";
    } else if (titleLower.includes("theatre") || titleLower.includes("drama") || titleLower.includes("play")) {
      category = "theatre";
    }

    const area = item.locality || cityCtx.areas[idx % cityCtx.areas.length];
    const venue = item.venue || cityCtx.venues[idx % cityCtx.venues.length];
    const eventDate = item.date || new Date(today.getTime() + (idx + 1) * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    return {
      id: item.id || `bms-${idx}`,
      title: item.title,
      description: `Official live event '${item.title}' in ${city}. Book tickets online.`,
      category,
      venue,
      locality: area,
      city,
      date: eventDate,
      time: "18:00",
      endTime: "21:00",
      price: {
        min: 499,
        max: 1999,
        currency: "INR",
        isFree: false,
      },
      image: item.image || getEventImage(category),
      tags: [category, "live", city.toLowerCase()],
      rating: 4.5,
      isTrending: idx < 3,
      bookingUrl: item.bookingUrl,
      latitude: cityCtx.lat + (Math.sin(idx + 1) * 0.02),
      longitude: cityCtx.lng + (Math.cos(idx + 1) * 0.02),
    };
  });
}

interface ScrapedBmsEvent {
  title: string;
  image: string;
  bookingUrl: string;
  id: string;
  venue?: string;
  locality?: string;
  date?: string;
}

const CITY_SLUG_MAP: Record<string, string[]> = {
  pune: ["pune-in", "pune", "pimpri-chinchwad"],
  delhi: ["new-delhi", "delhi-ncr", "delhi"],
  bangalore: ["bangalore", "bengaluru"],
  mumbai: ["mumbai"],
  indore: ["indore"],
  ujjain: ["ujjain"],
  kolhapur: ["kolhapur"],
  nashik: ["nashik"],
  jaipur: ["jaipur"],
  ahmedabad: ["ahmedabad"],
  goa: ["goa"],
};

function getBookMyShowRegion(city: string): string {
  const normCity = city.toLowerCase();
  if (normCity === "mumbai") return "mumbai";
  if (normCity === "bangalore" || normCity === "bengaluru") return "bengaluru";
  if (normCity === "delhi") return "ncr";
  if (normCity === "chennai") return "chennai";
  if (normCity === "kolhapur") return "kolhapur";
  if (normCity === "nashik") return "nashik";
  if (normCity === "pune") return "pune";
  return normCity;
}

async function scrapeBookMyShowEvents(city: string): Promise<ScrapedBmsEvent[]> {
  const region = getBookMyShowRegion(city);
  const url = `https://in.bookmyshow.com/explore/events-${region}`;
  
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      console.error(`BookMyShow request failed for ${city}:`, response.status);
      return [];
    }

    const html = await response.text();
    
    if (!html || html.length < 1000) {
      console.error(`Scraped html is empty or too short for ${city}`);
      return [];
    }
    
    const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    let match;
    const scrapedEvents: ScrapedBmsEvent[] = [];
    
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        if (json["@type"] === "ItemList" && Array.isArray(json.itemListElement)) {
          for (const item of json.itemListElement) {
            if (item.name && item.image) {
              const image = item.image;
              const idMatch = image.match(/events\/(et\d+)-/i);
              const id = idMatch ? idMatch[1].toUpperCase() : "";
              
              const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
              const bookingUrl = id ? `https://in.bookmyshow.com/events/${slugify(item.name)}/${id}` : url;
              
              scrapedEvents.push({
                title: item.name,
                image,
                bookingUrl,
                id: id || `bms-${slugify(item.name)}`
              });
            }
          }
        }
      } catch (_e) {
        // Ignore json parse errors
      }
    }
    
    return scrapedEvents;
  } catch (err) {
    console.error(`Fetching BookMyShow events failed for ${city}:`, err);
    return [];
  }
}

async function scrapeAllEvents(city: string): Promise<ScrapedBmsEvent[]> {
  const normCity = city.toLowerCase().trim();
  const slugs = CITY_SLUG_MAP[normCity] ?? [
    `${normCity}-in`,
    normCity.replace(/[^a-z0-9]+/g, "-"),
  ];

  for (const slug of slugs) {
    const url = `https://allevents.in/${slug}/all`;
    try {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) continue;
      const html = await response.text();
      if (!html || html.length < 1000 || html.includes("404 Error Page")) continue;

      const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
      let match;
      const scrapedEvents: ScrapedBmsEvent[] = [];

      while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
          const json = JSON.parse(match[1]);
          const list = Array.isArray(json) ? json : [json];
          for (const item of list) {
            if (item["@type"] === "Event" && item.name) {
              const eventTitle = item.name.trim();
              const eventTitleLower = eventTitle.toLowerCase();
              const targetCityLower = city.toLowerCase();

              // Exclude cross-city tour events (e.g. "Papon Live - Pune" when selected city is Mumbai)
              const majorCities = ["pune", "mumbai", "delhi", "bangalore", "bengaluru", "chennai", "kolkata", "hyderabad", "jaipur", "indore", "ujjain", "goa", "surat", "ahmedabad", "nashik", "kolhapur"];
              const isOtherCityEvent = majorCities.some((otherCity) => {
                if (otherCity === targetCityLower) return false;
                if (targetCityLower === "mumbai" && (otherCity === "pune" || otherCity === "delhi")) {
                  return eventTitleLower.includes(`- ${otherCity}`) || eventTitleLower.includes(`in ${otherCity}`);
                }
                return (
                  eventTitleLower.endsWith(`- ${otherCity}`) ||
                  eventTitleLower.includes(`- ${otherCity} `) ||
                  eventTitleLower.endsWith(`in ${otherCity}`) ||
                  eventTitleLower.includes(`in ${otherCity} `)
                );
              });

              if (isOtherCityEvent) continue;

              const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
              const eventUrl = item.url || url;
              const imageUrl = typeof item.image === "string" ? item.image : (item.image?.url || "");

              scrapedEvents.push({
                title: eventTitle,
                image: imageUrl,
                bookingUrl: eventUrl,
                id: `ae-${slugify(eventTitle)}`,
                venue: item.location?.name || `${city} Venue`,
                locality: item.location?.address?.addressLocality || city,
                date: item.startDate ? item.startDate.split("T")[0] : undefined,
              });
            }
          }
        } catch (_e) {}
      }

      if (scrapedEvents.length > 0) {
        return scrapedEvents;
      }
    } catch (_err) {
      // Continue to next slug
    }
  }

  return [];
}

async function scrapeLiveEvents(city: string): Promise<ScrapedBmsEvent[]> {
  const bmsEvents = await scrapeBookMyShowEvents(city);
  if (bmsEvents.length > 0) return bmsEvents;

  const aeEvents = await scrapeAllEvents(city);
  if (aeEvents.length > 0) return aeEvents;

  return [];
}

async function enrichScrapedEventsWithGemini(
  scrapedEvents: ScrapedBmsEvent[],
  city: string,
  cityCtx: typeof CITY_CONTEXT[string]
): Promise<LiveEvent[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const prompt = `You are an assistant that enriches real BookMyShow events into fully detailed JSON objects.
We have scraped a list of real upcoming events in ${city}, India.
Here is the list of scraped events (containing ID, title, image, and bookingUrl):
${JSON.stringify(scrapedEvents, null, 2)}

For each event in the list, generate a complete JSON object matching the schema below.
Schema for each event:
{
  "id": "must be the exact 'id' from the scraped event (e.g. ET00xxxxxx)",
  "title": "must be the exact 'title' from the scraped event",
  "description": "a 2-3 sentence engaging description of the event based on its title",
  "category": one of ["music", "comedy", "food-festival", "workshop", "sports", "cultural", "nightlife", "theatre", "tech"] (deduced from the title),
  "venue": "use the exact 'venue' from the scraped event if present, otherwise a realistic venue in ${city} from: ${cityCtx.venues.join(", ")}, or deduced from the title",
  "locality": "use the exact 'locality' from the scraped event if present, otherwise a realistic area in ${city} from: ${cityCtx.areas.join(", ")}, or deduced from the title/venue",
  "city": "${city}",
  "date": "YYYY-MM-DD (between ${todayStr} and ${in30Days})",
  "time": "HH:MM in 24h format",
  "endTime": "HH:MM in 24h format",
  "price": {
    "min": number (₹ amount, e.g. 299 to 3999 depending on category),
    "max": number (₹ amount),
    "currency": "INR",
    "isFree": false
  },
  "image": "must be the exact 'image' URL from the scraped event",
  "tags": ["tag1", "tag2", "tag3"] (e.g. category name, "live", "city"),
  "rating": number between 4.0 and 4.9,
  "isTrending": boolean (make 2-3 events trending),
  "bookingUrl": "must be the exact 'bookingUrl' from the scraped event",
  "artists": ["artist name"] (optional, name of main performers or speakers if obvious from the title),
  "latitude": number (realistic coords near ${cityCtx.lat} ± 0.04),
  "longitude": number (realistic coords near ${cityCtx.lng} ± 0.04)
}

Return ONLY the JSON array containing the enriched events, no markdown blocks, no formatting outside of valid JSON.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini enrichment error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  
  const events: LiveEvent[] = JSON.parse(cleanJsonText(rawText));
  return events;
}



export async function GET(request: NextRequest) {
  let rateLimitHeaders: Record<string, string> = {};

  try {
    const cityParam = (request.nextUrl.searchParams.get("city") ?? "Pune") as SupportedCityName;
    const category = request.nextUrl.searchParams.get("category") ?? "all";
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";
    rateLimitHeaders = await checkRateLimit(
      getClientIp(request),
      refresh ? "GET:/api/events/live:refresh" : "GET:/api/events/live",
      refresh ? refreshEventsRateLimit : liveEventsRateLimit
    );

    let cityCtx = CITY_CONTEXT[cityParam];
    if (!cityCtx) {
      const center = CITY_CENTERS[cityParam];
      if (center) {
        cityCtx = {
          venues: [
            `Grand Theater ${cityParam}`,
            `${cityParam} Convention Centre`,
            "Town Hall Arena",
            "The Pavillion Cafe",
            "Open Air Amphitheatre",
            "Royal Club",
            "Chamber of Commerce Hall",
            "District Sports Complex"
          ],
          areas: [
            "Downtown",
            "Mall Road",
            "Civil Lines",
            "High Street",
            "Sector 4",
            "Kala Nagar",
            "Lakefront",
            "Station Road"
          ],
          lat: center.latitude,
          lng: center.longitude,
        };
      } else {
        return withHeaders(Response.json({ error: "Unsupported city." }, { status: 400 }), rateLimitHeaders);
      }
    }

    if (!allowedCategories.has(category)) {
      return withHeaders(Response.json({ error: "Unsupported event category." }, { status: 400 }), rateLimitHeaders);
    }

    const cacheKey = `live-events:${cityParam.toLowerCase()}:v7`;

    let events: LiveEvent[] | null = refresh ? null : await getCache<LiveEvent[]>(cacheKey);

    if (!events) {
      console.log(`[Events API] Fetching real live events for ${cityParam}...`);
      const liveEvents = await scrapeLiveEvents(cityParam);

      if (liveEvents.length > 0) {
        try {
          console.log(`[Events API] Scraped ${liveEvents.length} real live events for ${cityParam}. Enriching with Gemini...`);
          events = await enrichScrapedEventsWithGemini(liveEvents, cityParam, cityCtx);
        } catch (enrichErr) {
          console.warn(`[Events API] Gemini enrichment failed for ${cityParam}, using direct scraped event formatting:`, enrichErr);
          events = formatScrapedEventsDirectly(liveEvents, cityParam, cityCtx);
        }
      } else {
        console.log(`[Events API] No live events found for ${cityParam}.`);
        events = [];
      }

      // Cache real events (or empty list for 10 mins if 0 events found)
      const ttl = events.length > 0 ? 60 * 60 * 3 : 60 * 10;
      await setCache(cacheKey, events, ttl);
    }

    // Filter by category
    const filtered = category === "all"
      ? events
      : events.filter((e) => e.category === category);

    // Sort: trending first, then by date
    const sorted = [...filtered].sort((a, b) => {
      if (a.isTrending !== b.isTrending) return Number(b.isTrending) - Number(a.isTrending);
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return withHeaders(
      Response.json({
        city: cityParam,
        category,
        count: sorted.length,
        events: sorted,
        generatedAt: new Date().toISOString(),
      }),
      rateLimitHeaders
    );
  } catch (error) {
    const { status, body } = serializeError(error);
    if (status >= 500) {
      console.error("Live events error:", error instanceof Error ? error.message : error);
    }
    if (error instanceof RateLimitError) {
      rateLimitHeaders["Retry-After"] = String(error.retryAfterSeconds);
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...rateLimitHeaders },
    });
  }
}
