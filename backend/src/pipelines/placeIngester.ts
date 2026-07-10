// backend/src/pipelines/placeIngester.ts

import { db } from "../db";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config();

export interface IngestionResult {
  city: string;
  source: "google" | "osm" | "simulation";
  extractedCount: number;
  cleansedCount: number;
  insertedCount: number;
  errors: string[];
}

export class PlaceIngester {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY || "";
  }

  /**
   * Run the full ETL pipeline for a given city
   */
  public async ingestCity(city: string): Promise<IngestionResult> {
    const errors: string[] = [];
    let source: IngestionResult["source"] = "osm";
    let extractedRaw: any[] = [];

    console.log(`🚀 Starting Places ETL Pipeline for city: ${city}`);

    // Step 1: EXTRACT
    try {
      if (this.apiKey && this.apiKey.trim() !== "") {
        console.log(`📡 Extracting from Google Places API for ${city}...`);
        extractedRaw = await this.extractFromGoogle(city);
        source = "google";
      } else {
        console.log(`📡 No Google Places API key found. Falling back to OpenStreetMap Overpass...`);
        extractedRaw = await this.extractFromOSM(city);
        source = "osm";
      }
    } catch (err: any) {
      console.warn(`⚠️ Primary extraction failed: ${err.message || err}. Falling back to simulation...`);
      errors.push(`Extraction failed: ${err.message}`);
      extractedRaw = this.generateSimulatedPlaces(city);
      source = "simulation";
    }

    console.log(`📦 Extracted ${extractedRaw.length} raw place listings.`);

    // Step 2: TRANSFORM & CLEANSE
    const cleansed = this.transformAndCleanse(extractedRaw, city);
    console.log(`🧹 Cleansed & standardized to ${cleansed.length} quality places.`);

    // Step 3: DEDUPLICATE & LOAD
    let insertedCount = 0;
    try {
      insertedCount = await this.loadToDatabase(cleansed);
      console.log(`💾 Bulk loaded ${insertedCount} new or updated places to the database.`);
    } catch (err: any) {
      console.error(`❌ Load phase failed:`, err);
      errors.push(`Database load failed: ${err.message}`);
    }

    return {
      city,
      source,
      extractedCount: extractedRaw.length,
      cleansedCount: cleansed.length,
      insertedCount,
      errors,
    };
  }

  /**
   * Extract from Google Places API text search
   */
  private async extractFromGoogle(city: string): Promise<any[]> {
    const textQuery = `famous tourist attractions, popular cafes, and top restaurants in ${city}`;
    const url = "https://places.googleapis.com/v1/places:searchText";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.editorialSummary,places.nationalPhoneNumber,places.websiteUri",
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "en",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Places HTTP ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as any;
    return data.places || [];
  }

  /**
   * Extract from OpenStreetMap Overpass API
   */
  private async extractFromOSM(city: string): Promise<any[]> {
    // Get city center coordinates from local helper/mapping or default centers
    const centers: Record<string, { lat: number; lng: number }> = {
      pune: { lat: 18.5204, lng: 73.8567 },
      mumbai: { lat: 19.076, lng: 72.8777 },
      bangalore: { lat: 12.9716, lng: 77.5946 },
      delhi: { lat: 28.6139, lng: 77.2090 },
      chennai: { lat: 13.0827, lng: 80.2707 },
      hyderabad: { lat: 17.3850, lng: 78.4867 },
    };

    const normCity = city.toLowerCase();
    const center = centers[normCity] || centers.pune;

    const query = `
      [out:json][timeout:25];
      (
        node(around:5000,${center.lat},${center.lng})["amenity"~"^(cafe|restaurant|bar|pub|nightclub|fast_food)$"]["name"];
        way(around:5000,${center.lat},${center.lng})["amenity"~"^(cafe|restaurant|bar|pub|nightclub|fast_food)$"]["name"];
        node(around:5000,${center.lat},${center.lng})["tourism"~"^(museum|viewpoint|attraction)$"]["name"];
      );
      out center tags 80;
    `;

    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ];

    let lastErr: any = null;
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "SheherPipeline/1.0",
          },
          signal: AbortSignal.timeout(12000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          return data.elements || [];
        }
        lastErr = new Error(`HTTP ${res.status} from ${endpoint}`);
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr || new Error("All OSM Overpass endpoints failed.");
  }

  /**
   * Ingestion fallback: Generate high-quality simulated places
   */
  private generateSimulatedPlaces(city: string): any[] {
    console.log(`ℹ️ Simulation: Generating backup mock places for ${city}`);
    const nowStr = new Date().toISOString();
    return [
      {
        id: `sim-${city.toLowerCase()}-1`,
        title: `${city} Central Bistro`,
        description: `A lovely central culinary hotspot in the heart of ${city}, famous for local dishes and warm vibes.`,
        category: "restaurant",
        rating: 4.6,
        latitude: 18.5204 + (Math.random() - 0.5) * 0.05,
        longitude: 73.8567 + (Math.random() - 0.5) * 0.05,
        tags: ["curated", "famous", "dinner"],
        phone: "+91 20 5555 1212",
        website: `https://${city.toLowerCase()}centralbistro.in`,
        priceRange: "$$",
      },
      {
        id: `sim-${city.toLowerCase()}-2`,
        title: `The Blue Java Cafe`,
        description: `An elegant workspace cafe serving premium filter coffee, artisanal cold brew, and fresh croissants.`,
        category: "cafe",
        rating: 4.5,
        latitude: 18.5204 + (Math.random() - 0.5) * 0.05,
        longitude: 73.8567 + (Math.random() - 0.5) * 0.05,
        tags: ["work-friendly", "wifi", "espresso"],
        phone: "+91 20 5555 3434",
        website: "https://bluejavacafe.in",
        priceRange: "$$",
      },
      {
        id: `sim-${city.toLowerCase()}-3`,
        title: `${city} Heritage Fort Walk`,
        description: `A classic scenic walking route presenting the beautiful monuments and historic architecture of the old city.`,
        category: "event",
        rating: 4.8,
        latitude: 18.5204 + (Math.random() - 0.5) * 0.05,
        longitude: 73.8567 + (Math.random() - 0.5) * 0.05,
        tags: ["heritage", "scenic", "walk"],
        priceRange: "Free",
      },
      {
        id: `sim-${city.toLowerCase()}-4`,
        title: `High Spirits Lounge`,
        description: `The city's trendiest nightlife hotspot featuring craft cocktails, neon lights, and live indie band performances.`,
        category: "nightlife",
        rating: 4.4,
        latitude: 18.5204 + (Math.random() - 0.5) * 0.05,
        longitude: 73.8567 + (Math.random() - 0.5) * 0.05,
        tags: ["lounge", "cocktails", "music"],
        phone: "+91 20 5555 8888",
        priceRange: "$$$",
      }
    ];
  }

  /**
   * Standardizes categories, handles defaults, parses coordinates, and removes bad records
   */
  private transformAndCleanse(rawList: any[], city: string): any[] {
    const cleansed: any[] = [];

    for (const raw of rawList) {
      try {
        let id = "";
        let title = "";
        let description = "";
        let category = "restaurant";
        let rating = 4.0;
        let latitude = 0;
        let longitude = 0;
        let tags: string[] = [];
        let priceRange = "$$";
        let phone: string | null = null;
        let website: string | null = null;
        let locality = "Central Area";

        // Handle source differences
        if (raw.id && typeof raw.id === "string" && raw.id.startsWith("sim-")) {
          // Simulation source
          id = raw.id;
          title = raw.title;
          description = raw.description;
          category = raw.category;
          rating = raw.rating;
          latitude = raw.latitude;
          longitude = raw.longitude;
          tags = raw.tags;
          phone = raw.phone || null;
          website = raw.website || null;
          priceRange = raw.priceRange;
        } else if (raw.displayName) {
          // Google Places source
          id = `google-${raw.id}`;
          title = raw.displayName.text;
          description = raw.editorialSummary?.text || `A popular local spot in ${city}.`;
          rating = raw.rating || 4.2;
          latitude = raw.location?.latitude;
          longitude = raw.location?.longitude;
          phone = raw.nationalPhoneNumber || null;
          website = raw.websiteUri || null;
          priceRange = raw.priceRange || "$$";

          // Determine category
          const types = raw.types || [];
          if (types.includes("cafe") || types.includes("coffee_shop")) category = "cafe";
          else if (types.includes("bar") || types.includes("pub")) category = "bar";
          else if (types.includes("night_club")) category = "nightlife";
          else if (types.includes("bakery") || types.includes("dessert_shop")) category = "dessert";
          else if (types.includes("tourist_attraction") || types.includes("museum") || types.includes("park")) category = "event";

          tags = types.slice(0, 4).map((t: string) => t.toLowerCase().replace(/_/g, "-"));
        } else {
          // OSM source
          id = `osm-${raw.type}-${raw.id}`;
          const t = raw.tags || {};
          title = t.name;
          latitude = raw.lat ?? raw.center?.lat;
          longitude = raw.lon ?? raw.center?.lon;
          phone = t.phone || t["contact:phone"] || null;
          website = t.website || t["contact:website"] || null;

          const amenity = t.amenity;
          if (amenity === "cafe") category = "cafe";
          else if (amenity === "bar" || amenity === "pub") category = "bar";
          else if (amenity === "nightclub") category = "nightlife";
          else if (amenity === "fast_food" || amenity === "food_court") category = "food-stall";
          else if (amenity === "ice_cream") category = "ice-cream";
          else if (t.shop === "bakery") category = "dessert";
          else if (t.tourism === "museum" || t.leisure === "park") category = "event";

          description = t.description || `A beloved neighborhood ${category} situated in ${city}.`;
          rating = 4.2; // default synthetic rating
          tags = [category, "osm"];
          if (t.cuisine) tags.push(...t.cuisine.split(";").map((c: string) => c.trim().toLowerCase()));
        }

        // Quality check filters
        if (!title || title.trim() === "") continue;
        if (!latitude || !longitude) continue;
        if (rating < 3.5) {
          console.log(`⏩ Skipping low-rated spot: ${title} (${rating})`);
          continue;
        }

        // Map categories properly to check constraint values:
        // 'cafe', 'restaurant', 'event', 'nightlife', 'food-stall', 'bar', 'dessert', 'street-food'
        // If not, fall back to restaurant or event
        const validCategories = new Set(['cafe', 'restaurant', 'event', 'nightlife', 'food-stall', 'bar', 'dessert', 'street-food']);
        if (!validCategories.has(category)) {
          if (category === "ice-cream" || category === "food-street" || category === "street-food") {
            category = "street-food";
          } else {
            category = "restaurant";
          }
        }

        // Parse locality
        if (raw.formattedAddress) {
          const parts = raw.formattedAddress.split(",");
          locality = parts[parts.length - 3]?.trim() || "Central Area";
        }

        // Placeholder image based on category
        const images: Record<string, string> = {
          cafe: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=420&fit=crop",
          restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=420&fit=crop",
          bar: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&h=420&fit=crop",
          event: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=420&fit=crop",
          nightlife: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=420&fit=crop",
          "food-stall": "https://images.unsplash.com/photo-1565123409695-7b5ec62907be?w=600&h=420&fit=crop",
          dessert: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&h=420&fit=crop",
          "street-food": "https://images.unsplash.com/photo-1565123409695-7b5ec62907be?w=600&h=420&fit=crop",
        };

        const image = images[category] || images.restaurant;

        cleansed.push({
          id,
          title,
          description,
          category,
          image,
          rating,
          latitude,
          longitude,
          tags,
          city,
          locality,
          priceRange,
          phone,
          website,
          hours: { open: "09:00", close: "22:00" },
        });
      } catch (err) {
        console.warn("⚠️ Failed to parse raw place entry, skipping:", err);
      }
    }

    return cleansed;
  }

  /**
   * Load clean places into Approved_places with deduplication
   */
  private async loadToDatabase(places: any[]): Promise<number> {
    if (places.length === 0) return 0;

    let loadedCount = 0;
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      for (const place of places) {
        // Deduplicate against existing coordinates (within ~50m)
        // Approx 0.0005 degrees latitude/longitude difference is ~55 meters
        const { rows: duplicateCheck } = await client.query(
          `
          SELECT id FROM approved_places
          WHERE city = $1 AND ABS(latitude - $2) < 0.0005 AND ABS(longitude - $3) < 0.0005
          LIMIT 1
          `,
          [place.city, place.latitude, place.longitude]
        );

        let targetId = place.id;
        if (duplicateCheck.length > 0) {
          targetId = duplicateCheck[0].id;
          console.log(`🔄 Deduplication: Place matching ${place.title} coordinates found. Merging to ID ${targetId}...`);
        }

        // Upsert approved_places
        await client.query(
          `
          INSERT INTO approved_places (
            id, title, description, category, image, rating, latitude, longitude, tags, city, locality, price_range, phone, website, hours, location
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, ST_SetSRID(ST_MakePoint($8, $7), 4326))
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            rating = EXCLUDED.rating,
            tags = EXCLUDED.tags,
            locality = EXCLUDED.locality,
            price_range = EXCLUDED.price_range,
            phone = EXCLUDED.phone,
            website = EXCLUDED.website,
            hours = EXCLUDED.hours,
            location = EXCLUDED.location
          `,
          [
            targetId,
            place.title,
            place.description,
            place.category,
            place.image,
            place.rating,
            place.latitude,
            place.longitude,
            place.tags,
            place.city,
            place.locality,
            place.priceRange,
            place.phone,
            place.website,
            JSON.stringify(place.hours),
          ]
        );

        loadedCount++;
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return loadedCount;
  }
}
