import { CITY_CENTERS, SupportedCityName } from "@/lib/pune-location";
import { Place, PlaceCategory } from "@/types";
import { fetchLiveTownEvents } from "@/lib/town-events";
import { mergePlaces } from "@/lib/merge-places";
import { MOCK_PLACES, enrichTags } from "@/data/mock-places";
import { getPool } from "@/lib/postgres";
import { resolvePlaceImage } from "@/lib/place-images";

const DYNAMIC_CATEGORIES: { category: PlaceCategory; prefix: string[]; desc: string; price: string }[] = [
  { category: "cafe", prefix: ["Artisanal Roastery", "Botanical Cafe", "The Coffee Studio", "Heritage Bean", "Rooftop Brew Lab", "Urban Espresso Bar", "The Bookish Cafe", "Social Roasters"], desc: "Cozy specialty coffee hub with artisanal brews, fresh bakes, and peaceful vibes.", price: "$$" },
  { category: "restaurant", prefix: ["Royal Thali Dining", "The Grand Kitchen", "Spice Route Grill", "Coastal Seafood House", "Tandoor & Charcoal", "Olive Garden Bistro", "Urban Gourmet Table", "Heritage Flavors"], desc: "Highly-rated dining venue known for authentic regional specialties and warm hospitality.", price: "$$$" },
  { category: "bar", prefix: ["Skyline Rooftop Lounge", "The Vault Taproom", "High Spirits Bar", "The Craft Brewery", "Sunset Cocktail Bar", "Urban Pub & Kitchen"], desc: "Lively local bar featuring craft brews, signature mixes, and high-energy evening tracks.", price: "$$$" },
  { category: "food-stall", prefix: ["Central Chat Corner", "Iconic Dosa Junction", "Famous Roll Counter", "Pav Bhaji Express", "Crispy Samosa House", "Kulfi & Falooda Depot"], desc: "Bustling local street counter serving iconic, hot, and authentic city flavors.", price: "$" },
  { category: "dessert", prefix: ["Artisanal Bakery & Cakes", "The Chocolate Room", "Pastry & Confectionery", "Waffle & Pancake House", "Sweet Tooth Corner"], desc: "Delightful dessert destination for fresh cakes, pastries, and sweet cravings.", price: "$$" },
  { category: "ice-cream", prefix: ["Creamy Scoops Parlor", "Gelato Craft House", "Fruit & Sundae Depot", "Artisanal Ice Creams"], desc: "Beloved ice cream parlor offering rich, handcrafted scoops and frozen delights.", price: "$" },
  { category: "event", prefix: ["Heritage Fort & Gardens", "City Cultural Museum", "Botanical Lake & Park", "Town Hall Art Center", "Central Promenade Walk", "Grand Heritage Palace"], desc: "Prominent city landmark and peaceful outdoor retreat, perfect for sightseeing and strolls.", price: "$" },
  { category: "nightlife", prefix: ["Club Velocity", "The Underground Beat", "Echo Nightclub", "Pulse Disco & Bar"], desc: "High-energy evening club with stellar DJ sets, dance floor, and night vibes.", price: "$$$$" },
];

function generateScaledCityPlaces(city: SupportedCityName, countNeeded: number): Place[] {
  const center = CITY_CENTERS[city] || CITY_CENTERS.Pune;
  const places: Place[] = [];
  
  let idIdx = 1;
  while (places.length < countNeeded && idIdx < 120) {
    for (const catConfig of DYNAMIC_CATEGORIES) {
      const prefixName = catConfig.prefix[idIdx % catConfig.prefix.length];
      const name = `${prefixName} · ${city} #${Math.floor(idIdx / catConfig.prefix.length) + 1}`;
      const latOffset = Math.sin(idIdx * 1.7) * 0.035;
      const lngOffset = Math.cos(idIdx * 2.3) * 0.035;
      const placeId = `scaled-${city.toLowerCase()}-${catConfig.category}-${idIdx}`;
      
      places.push({
        id: placeId,
        title: name,
        description: `${catConfig.desc} Located in the heart of ${city}.`,
        category: catConfig.category,
        image: resolvePlaceImage({ id: placeId, title: name, category: catConfig.category, city }),
        rating: Math.round((4.3 + (idIdx % 6) * 0.1) * 10) / 10,
        latitude: center.latitude + latOffset,
        longitude: center.longitude + lngOffset,
        distance: 0,
        tags: [catConfig.category, "popular", "curated", city.toLowerCase()],
        city,
        locality: `${city} Central`,
        isOpen: true,
        isTrending: idIdx % 3 === 0,
        reviewCount: 250 + (idIdx * 73) % 4500,
        priceRange: catConfig.price,
        isVeg: catConfig.category === "dessert" || catConfig.category === "ice-cream" || idIdx % 2 === 0,
        hours: { open: "09:00", close: "23:00" },
      });

      idIdx++;
      if (places.length >= countNeeded) break;
    }
  }

  return places;
}

export const getFallbackPlacesForCity = async (city: SupportedCityName): Promise<Place[]> => {
  let dbPlaces: Place[] = [];
  const pool = getPool();
  
  if (pool) {
    try {
      const { rows } = await pool.query(
        `
        SELECT
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
          price_range AS "priceRange",
          phone,
          website,
          hours,
          review_mood AS "reviewMood"
        FROM approved_places
        WHERE city = $1
        LIMIT 100
        `,
        [city]
      );
      dbPlaces = rows.map((row: any) => ({
        ...row,
        isOpen: true,
        isTrending: false,
        reviewCount: 0,
        distance: 0,
        tags: enrichTags(row.title, row.category, row.tags || []),
        hours: row.hours ? (typeof row.hours === "string" ? JSON.parse(row.hours) : row.hours) : undefined,
        reviewMood: row.reviewMood ? (typeof row.reviewMood === "string" ? JSON.parse(row.reviewMood) : row.reviewMood) : undefined
      }));
    } catch (dbErr) {
      console.warn("Failed to fetch curated db places, falling back to mock data:", dbErr);
    }
  }

  // Base places
  const curatedPlaces = dbPlaces.length > 0 
    ? dbPlaces 
    : MOCK_PLACES.filter((place) => place.city.toLowerCase() === city.toLowerCase());

  // Ensure every city has 60+ places minimum
  let fullPlaces = curatedPlaces;
  if (fullPlaces.length < 60) {
    const needed = 60 - fullPlaces.length;
    const extraPlaces = generateScaledCityPlaces(city, needed);
    fullPlaces = [...fullPlaces, ...extraPlaces];
  }

  try {
    const townEvents = await fetchLiveTownEvents(city);
    return mergePlaces(fullPlaces, townEvents);
  } catch (e) {
    return fullPlaces;
  }
};
