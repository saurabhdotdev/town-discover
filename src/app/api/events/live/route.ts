import { NextRequest } from "next/server";
import { execSync } from "child_process";
import { getCache, setCache } from "@/lib/redis";
import { SupportedCityName } from "@/lib/pune-location";
import { getTownEventsForCity } from "@/data/town-events";

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

function getEventImage(category: string): string {
  return CATEGORY_IMAGES[category] ?? "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=420&fit=crop";
}

function generateLocalFallbackEvents(city: SupportedCityName): LiveEvent[] {
  const cityCtx = CITY_CONTEXT[city];
  if (!cityCtx) return [];

  const categories: LiveEvent["category"][] = [
    "music", "music", "nightlife", "nightlife",
    "comedy", "comedy",
    "food-festival", "food-festival",
    "workshop", "workshop",
    "sports",
    "cultural", "cultural",
    "theatre",
    "tech"
  ];

  const eventTemplates: Record<LiveEvent["category"], { titles: string[]; descriptions: string[] }> = {
    music: {
      titles: [
        "Acoustic Sunset Sessions",
        "Indie Rock Night Live",
        "Electronic Music Showcase",
        "Classical Jugalbandi Concert"
      ],
      descriptions: [
        "Experience an evening of soulful acoustic melodies and soft lighting. Perfect for a relaxed vibe.",
        "Catch the city's finest independent rock acts performing their latest tracks live on stage.",
        "A high-energy night featuring local DJs spinning progressive house and techno beats.",
        "A beautiful fusion of Hindustani and Carnatic classical music by seasoned artists."
      ]
    },
    nightlife: {
      titles: [
        "Neon Dance Party",
        "Retro Disco Night",
        "Skyline Lounge Mixer",
        "Late Night Club Bash"
      ],
      descriptions: [
        "Dance the night away under vibrant neon lights with exclusive signature mocktails/cocktails.",
        "Travel back in time with classic disco hits, groovy dance moves, and retro outfits.",
        "Unwind with panoramic city views, smooth lounge music, and a premium curated menu.",
        "An energetic club night with pulsating basslines, visual lasers, and a packed dance floor."
      ]
    },
    comedy: {
      titles: [
        "Stand-up Comedy Open Mic",
        "Weekend Comedy Special",
        "Improv Comedy Showdown"
      ],
      descriptions: [
        "Watch local comedians try out their newest material. Laughter guaranteed (or at least attempted!).",
        "A curated lineup of the region's best stand-up comics delivering their headline sets.",
        "Completely unscripted and hilarious improv games based entirely on audience suggestions."
      ]
    },
    "food-festival": {
      titles: [
        "Street Food Carnival",
        "Dessert & Pastry Fest",
        "Barbecue & Grills Night"
      ],
      descriptions: [
        "Indulge in authentic local street foods, spicy chaats, and fusion snacks from top vendors.",
        "Satisfy your sweet tooth with artisanal chocolates, fresh pastries, and creative ice creams.",
        "Enjoy flame-grilled delicacies, slow-cooked meats, and grilled veggies in an outdoor setting."
      ]
    },
    workshop: {
      titles: [
        "Beginner's Pottery Workshop",
        "Canvas Painting Masterclass",
        "Artisanal Coffee Brewing"
      ],
      descriptions: [
        "Get your hands dirty and learn the basics of wheel throwing and clay shaping.",
        "Unleash your inner artist on a blank canvas with step-by-step guidance from an expert painter.",
        "Discover the secrets behind pour-overs, aeropress, and milk steaming for the perfect cup."
      ]
    },
    sports: {
      titles: [
        "Weekend Morning Cyclothon",
        "Charity 5K Trail Run",
        "Under-the-Lights Football Turf Tournament"
      ],
      descriptions: [
        "A scenic group cycling ride along quiet morning roads. All fitness levels welcome.",
        "A scenic 5K run through wooded trails to promote health, wellness, and local community.",
        "Fast-paced 5-on-5 football tournament under bright turf floodlights. Register your team."
      ]
    },
    cultural: {
      titles: [
        "Heritage Photography Walk",
        "Folk Dance & Art Exhibition",
        "Poetry & Spoken Word Slam"
      ],
      descriptions: [
        "Explore historic alleyways and monuments while learning architectural photography tips.",
        "Celebrate local traditions with dynamic folk dance performances and handloom crafts bazaar.",
        "A powerful evening of original poetry, storytelling, and acoustic musical interludes."
      ]
    },
    theatre: {
      titles: [
        "Classic Hindi Drama Play",
        "Interactive Murder Mystery Theatre",
        "Experimental Solo Act Showcase"
      ],
      descriptions: [
        "A gripping theatrical production exploring timeless human relationships and social dynamics.",
        "Put your detective hat on and help solve a crime as the drama unfolds around your table.",
        "Intimate solo performances pushing the boundaries of traditional storytelling and stage presence."
      ]
    },
    tech: {
      titles: [
        "AI & Future of Web Tech Talk",
        "Hackathon & Prototyping Meetup",
        "Product Design Panel Discussion"
      ],
      descriptions: [
        "Connect with local developers to discuss AI agents, Next.js advances, and engineering trends.",
        "An intense day of coding, designing, and pitching new software solutions in teams.",
        "Learn from industry leads about user experience, UI architecture, and product growth loops."
      ]
    }
  };

  const today = new Date();
  
  return categories.map((cat, idx) => {
    const templates = eventTemplates[cat];
    const title = templates.titles[idx % templates.titles.length];
    const description = templates.descriptions[idx % templates.descriptions.length];
    
    const area = cityCtx.areas[idx % cityCtx.areas.length];
    const venue = cityCtx.venues[idx % cityCtx.venues.length];
    
    const dateOffset = idx + 1;
    const targetDate = new Date(today.getTime() + dateOffset * 24 * 60 * 60 * 1000);
    const dateStr = targetDate.toISOString().split("T")[0];
    
    const hour = 10 + (idx * 3) % 12;
    const timeStr = `${hour.toString().padStart(2, "0")}:30`;
    const endTimeStr = `${(hour + 2).toString().padStart(2, "0")}:30`;
    
    const isFree = idx % 5 === 0;
    const minPrice = isFree ? 0 : 250 + (idx * 150) % 2000;
    const maxPrice = isFree ? 0 : minPrice + 200 + (idx * 100) % 1000;
    
    const rating = Math.round((4.0 + (idx * 0.13) % 0.9) * 10) / 10;
    
    return {
      id: `local-evt-${city.toLowerCase()}-${cat}-${idx}`,
      title: `${city} ${title}`,
      description,
      category: cat,
      venue,
      locality: area,
      city,
      date: dateStr,
      time: timeStr,
      endTime: endTimeStr,
      price: {
        min: minPrice,
        max: maxPrice,
        currency: "INR" as const,
        isFree,
      },
      image: getEventImage(cat),
      tags: [cat, "local", "community", isFree ? "free" : "paid"],
      rating,
      isTrending: idx < 3,
      latitude: cityCtx.lat + (Math.sin(idx) * 0.03),
      longitude: cityCtx.lng + (Math.cos(idx) * 0.03),
    };
  });
}

function fallbackCuratedEvents(city: string): LiveEvent[] {
  // Generate programmatic mock events for testing
  const localGenerated = generateLocalFallbackEvents(city as SupportedCityName);

  const curated = getTownEventsForCity(city);
  const mappedCurated: LiveEvent[] = curated.map((place): LiveEvent => {
    let category: LiveEvent["category"] = "cultural";
    const tagsLower = place.tags.map(t => t.toLowerCase());
    
    if (tagsLower.some(t => ["music", "concert", "gig", "band"].includes(t))) {
      category = "music";
    } else if (tagsLower.some(t => ["comedy", "standup", "stand-up"].includes(t))) {
      category = "comedy";
    } else if (tagsLower.some(t => ["food", "fest", "foodie", "snack", "street-food"].includes(t))) {
      category = "food-festival";
    } else if (tagsLower.some(t => ["workshop", "class", "art", "learn"].includes(t))) {
      category = "workshop";
    } else if (tagsLower.some(t => ["nightlife", "party", "club", "bar"].includes(t))) {
      category = "nightlife";
    } else if (tagsLower.some(t => ["sports", "game", "cycling", "run"].includes(t))) {
      category = "sports";
    }

    let minPrice = 0;
    let maxPrice = 0;
    if (place.priceRange === "$$") {
      minPrice = 290; maxPrice = 490;
    } else if (place.priceRange === "$$$") {
      minPrice = 990; maxPrice = 1490;
    } else if (place.priceRange === "$$$$") {
      minPrice = 1990; maxPrice = 3990;
    }

    const isFree = place.tags.includes("free") || minPrice === 0;

    const today = new Date();
    let dateStr = today.toISOString().split("T")[0];
    if (place.tags.includes("weekend")) {
      const day = today.getDay();
      const diff = day === 0 ? 0 : 6 - day;
      const sat = new Date(today.getTime() + diff * 24 * 60 * 60 * 1000);
      dateStr = sat.toISOString().split("T")[0];
    } else if (!place.tags.includes("tonight")) {
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      dateStr = tomorrow.toISOString().split("T")[0];
    }

    return {
      id: place.id,
      title: place.title,
      description: place.description,
      category,
      venue: place.locality + " Event Venue",
      locality: place.locality,
      city: place.city,
      date: dateStr,
      time: place.hours?.open || "18:00",
      endTime: place.hours?.close || "21:00",
      price: {
        min: minPrice,
        max: maxPrice,
        currency: "INR" as const,
        isFree,
      },
      image: place.image,
      tags: place.tags,
      rating: place.rating,
      isTrending: place.isTrending,
      latitude: place.latitude,
      longitude: place.longitude,
    };
  });

  // Combine them, ensuring curated takes precedence and removing duplicates by title
  const combined = [...mappedCurated];
  localGenerated.forEach((evt) => {
    if (!combined.some(c => c.title.toLowerCase() === evt.title.toLowerCase())) {
      combined.push(evt);
    }
  });

  return combined;
}

interface ScrapedBmsEvent {
  title: string;
  image: string;
  bookingUrl: string;
  id: string;
}

function getBookMyShowRegion(city: string): string {
  const normCity = city.toLowerCase();
  if (normCity === "mumbai") return "mumbai";
  if (normCity === "bangalore" || normCity === "bengaluru") return "bengaluru";
  if (normCity === "delhi") return "ncr";
  if (normCity === "chennai") return "chennai";
  if (normCity === "kolhapur") return "kolhapur";
  if (normCity === "nashik") return "nashik";
  return normCity;
}

async function scrapeBookMyShowEvents(city: string): Promise<ScrapedBmsEvent[]> {
  const region = getBookMyShowRegion(city);
  const url = `https://in.bookmyshow.com/explore/events-${region}`;
  
  try {
    const cmd = `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "${url}"`;
    const html = execSync(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 8000 }).toString();
    
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
      } catch (e) {
        // Ignore json errors
      }
    }
    
    return scrapedEvents;
  } catch (err) {
    console.error(`Scraping BookMyShow failed for ${city} using curl:`, err);
    return [];
  }
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
  "venue": "realistic venue in ${city} from this list: ${cityCtx.venues.join(", ")}, or deduced from the title",
  "locality": "realistic area/locality in ${city} from this list: ${cityCtx.areas.join(", ")}, or deduced from the title/venue",
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
        temperature: 0.85,
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
  
  const events: LiveEvent[] = JSON.parse(rawText);
  return events;
}

async function generateEventsWithGemini(city: string, cityCtx: typeof CITY_CONTEXT[string]): Promise<LiveEvent[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const prompt = `Generate a realistic list of 12 upcoming events happening in ${city}, India between ${todayStr} and ${in30Days}.

Use these real venues from ${city}: ${cityCtx.venues.join(", ")}
Use these real areas/localities: ${cityCtx.areas.join(", ")}

Return a JSON array. Each event must have:
{
  "id": "evt-<city-lowercase>-<slug>",
  "title": "event title",
  "description": "2-3 sentence engaging description of the event",
  "category": one of ["music", "comedy", "food-festival", "workshop", "sports", "cultural", "nightlife", "theatre", "tech"],
  "venue": "venue name from the list above",
  "locality": "area/locality from the list above",
  "city": "${city}",
  "date": "YYYY-MM-DD (between ${todayStr} and ${in30Days})",
  "time": "HH:MM in 24h format",
  "endTime": "HH:MM in 24h format",
  "price": {
    "min": number (₹ amount, 0 if free),
    "max": number (₹ amount),
    "currency": "INR",
    "isFree": boolean
  },
  "tags": ["tag1", "tag2", "tag3"],
  "rating": number between 4.0-4.9,
  "isTrending": boolean (true for ~3 events),
  "artists": ["artist/performer name"] (optional, for music/comedy/theatre),
  "latitude": number (realistic coords near ${cityCtx.lat} ± 0.04),
  "longitude": number (realistic coords near ${cityCtx.lng} ± 0.04)
}

Mix categories: 3 music/nightlife, 2 comedy, 2 food-festival, 2 workshops, 1 theatre, 1 cultural, 1 tech/sports.
Include artists for music shows (local + upcoming Indian artists like Prateek Kuhad, The Local Train, Ritviz, Nucleya, etc.).
Make events feel real and immersive — real ticket prices (₹299-₹3999), realistic timings (evenings, weekends), genuine descriptions.
Return ONLY the JSON array, no explanation.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.85,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  
  let events: LiveEvent[] = JSON.parse(rawText);

  // Post-process: assign images based on category
  events = events.map((evt) => ({
    ...evt,
    image: getEventImage(evt.category),
  }));

  return events;
}

export async function GET(request: NextRequest) {
  try {
    const cityParam = (request.nextUrl.searchParams.get("city") ?? "Pune") as SupportedCityName;
    const category = request.nextUrl.searchParams.get("category") ?? "all";
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    const cityCtx = CITY_CONTEXT[cityParam];
    if (!cityCtx) {
      return Response.json({ error: `City "${cityParam}" not supported` }, { status: 400 });
    }

    const cacheKey = `live-events:${cityParam.toLowerCase()}:v2`;

    let events: LiveEvent[] | null = refresh ? null : await getCache<LiveEvent[]>(cacheKey);

    if (!events) {
      try {
        console.log(`Scraping BookMyShow events for ${cityParam}...`);
        const bmsEvents = await scrapeBookMyShowEvents(cityParam);
        
        let geminiEvents: LiveEvent[] = [];
        if (bmsEvents.length > 0) {
          console.log(`Successfully scraped ${bmsEvents.length} real events. Enriching with Gemini...`);
          geminiEvents = await enrichScrapedEventsWithGemini(bmsEvents, cityParam, cityCtx);
        } else {
          console.log(`No events scraped. Generating mock events with Gemini...`);
          geminiEvents = await generateEventsWithGemini(cityParam, cityCtx);
        }
        
        const curated = fallbackCuratedEvents(cityParam);
        
        // Merge unique ones
        const combined = [...geminiEvents];
        curated.forEach((c) => {
          if (!combined.some(g => g.title.toLowerCase() === c.title.toLowerCase())) {
            combined.push(c);
          }
        });
        
        events = combined;
        // Cache for 3 hours
        await setCache(cacheKey, events, 60 * 60 * 3);
      } catch (geminiError) {
        console.error("Gemini/Scraper event generation failed, falling back to curated events:", geminiError);
        events = fallbackCuratedEvents(cityParam);
        // Cache for 5 minutes when falling back
        await setCache(cacheKey, events, 60 * 5);
      }
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

    return Response.json({
      city: cityParam,
      category,
      count: sorted.length,
      events: sorted,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Live events error:", error);
    return Response.json({ error: error.message ?? "Failed to generate events" }, { status: 500 });
  }
}
