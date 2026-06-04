import { Place } from "@/types";

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
  name: string;
}

export const ROUTE_PRESETS: Record<string, { start: GeoCoordinate; end: GeoCoordinate; label: string }> = {
  "pune-mumbai": {
    label: "🚗 Pune ➔ Mumbai (Exp expressway)",
    start: { latitude: 18.5204, longitude: 73.8567, name: "Pune" },
    end: { latitude: 19.0760, longitude: 72.8777, name: "Mumbai" },
  },
  "mumbai-lonavala": {
    label: "⛰️ Mumbai ➔ Lonavala (Hill escape)",
    start: { latitude: 19.0760, longitude: 72.8777, name: "Mumbai" },
    end: { latitude: 18.7481, longitude: 73.4072, name: "Lonavala" },
  },
  "pune-mahabaleshwar": {
    label: "🍓 Pune ➔ Mahabaleshwar (Scenic ghats)",
    start: { latitude: 18.5204, longitude: 73.8567, name: "Pune" },
    end: { latitude: 17.9307, longitude: 73.6477, name: "Mahabaleshwar" },
  },
  "mumbai-alibaug": {
    label: "🏖️ Mumbai ➔ Alibaug (Coastal drive)",
    start: { latitude: 19.0760, longitude: 72.8777, name: "Mumbai" },
    end: { latitude: 18.6584, longitude: 72.8777, name: "Alibaug" },
  },
};

export async function geocodePlace(query: string): Promise<GeoCoordinate | null> {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const presets: Record<string, GeoCoordinate> = {
    pune: { latitude: 18.5204, longitude: 73.8567, name: "Pune, MH" },
    mumbai: { latitude: 19.0760, longitude: 72.8777, name: "Mumbai, MH" },
    lonavala: { latitude: 18.7481, longitude: 73.4072, name: "Lonavala, MH" },
    khandala: { latitude: 18.7602, longitude: 73.3754, name: "Khandala, MH" },
    mahabaleshwar: { latitude: 17.9307, longitude: 73.6477, name: "Mahabaleshwar, MH" },
    alibaug: { latitude: 18.6584, longitude: 72.8777, name: "Alibaug, MH" },
    satara: { latitude: 17.6805, longitude: 73.9918, name: "Satara, MH" },
    kolhapur: { latitude: 16.7050, longitude: 74.2433, name: "Kolhapur, MH" },
    nashik: { latitude: 19.9975, longitude: 73.7898, name: "Nashik, MH" },
  };

  if (presets[q]) return presets[q];
  for (const key of Object.keys(presets)) {
    if (q.includes(key)) return presets[key];
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
    );
    if (!res.ok) throw new Error("Nominatim API error");
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        name: data[0].display_name.split(",")[0] || query,
      };
    }
  } catch (err) {
    console.error("OSM Geocoding failed:", err);
  }

  // Final fallback to Pune center if no match
  return { latitude: 18.5204, longitude: 73.8567, name: query };
}

export function generateStopsAlongRoute(
  startName: string,
  endName: string,
  routeCoords: { latitude: number; longitude: number }[]
): Place[] {
  if (routeCoords.length < 5) return [];

  const stops: Place[] = [];
  const startLower = startName.toLowerCase();
  const endLower = endName.toLowerCase();
  const isPuneToMumbai =
    (startLower.includes("pune") && endLower.includes("mumbai")) ||
    (startLower.includes("mumbai") && endLower.includes("pune"));

  const milestones = [0.12, 0.25, 0.38, 0.52, 0.68, 0.82, 0.92];

  milestones.forEach((pct, index) => {
    const idx = Math.floor(routeCoords.length * pct);
    const coord = routeCoords[idx];
    if (!coord) return;

    // Shift coordinates slightly off the main road so they don't sit right on the polyline
    const latOffset = (index % 2 === 0 ? 0.0015 : -0.0015) + index * 0.0002;
    const lngOffset = (index % 3 === 0 ? 0.0018 : -0.0018) - index * 0.0001;
    const stopLat = coord.latitude + latOffset;
    const stopLng = coord.longitude + lngOffset;

    if (isPuneToMumbai) {
      // High-fidelity specific spots for Pune-Mumbai Expressway!
      if (index === 0) {
        stops.push({
          id: `pm-stop-urse-${index}`,
          title: "Urse Toll Plaza EV Hub",
          description: "Jio-bp Pulse super-fast charging station with 60kW CCS2 dual chargers. Includes clean Sulabh toilets and a Chai point.",
          category: "event",
          image: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600&h=420&fit=crop",
          rating: 4.8,
          latitude: stopLat,
          longitude: stopLng,
          tags: ["ev-station", "highway-stop", "fast-charge", "toilet"],
          city: "Pune",
          locality: "Urse Toll Plaza, Expressway",
          isOpen: true,
          isTrending: true,
          reviewCount: 340,
          priceRange: "₹15/kWh",
          distance: 0,
          hours: { open: "00:00", close: "23:59" },
        });
      } else if (index === 1) {
        stops.push({
          id: `pm-stop-lonavala-chikki-${index}`,
          title: "Maganlal Chikki Expressway Plaza",
          description: "Famous Lonavala Chikki spot, hot snacks, fresh vada pavs, and premium highway rest area with clean public toilets.",
          category: "food-stall",
          image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=420&fit=crop",
          rating: 4.6,
          latitude: stopLat,
          longitude: stopLng,
          tags: ["food-stall", "highway-stop", "chikki", "toilet", "breakfast"],
          city: "Lonavala",
          locality: "NH48 Expressway bypass",
          isOpen: true,
          isTrending: true,
          reviewCount: 1200,
          priceRange: "₹",
          distance: 0,
          hours: { open: "06:00", close: "23:00" },
        });
      } else if (index === 2) {
        stops.push({
          id: `pm-stop-scenic-point-${index}`,
          title: "Amrutanjan Point Scenic Overlook",
          description: "Breathtaking panoramic spot overlooking the Duke's Nose hill and old railway line. Incredible breeze, great for quick photos.",
          category: "event",
          image: "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=600&h=420&fit=crop",
          rating: 4.7,
          latitude: stopLat,
          longitude: stopLng,
          tags: ["viewpoint", "highway-stop", "scenic", "photos"],
          city: "Khandala",
          locality: "Khandala Ghats",
          isOpen: true,
          isTrending: false,
          reviewCount: 890,
          priceRange: "Free",
          distance: 0,
          hours: { open: "00:00", close: "23:59" },
        });
      } else if (index === 3) {
        stops.push({
          id: `pm-stop-khalapur-${index}`,
          title: "Khalapur Food Mall (McD & EV)",
          description: "Mega highway food plaza featuring McDonald's, Starbucks, KFC, and local Maharashtrian dhabas. Equipped with Tata Power EZ EV Chargers.",
          category: "restaurant",
          image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&h=420&fit=crop",
          rating: 4.5,
          latitude: stopLat,
          longitude: stopLng,
          tags: ["highway-stop", "ev-station", "toilet", "fast-charge", "food-plaza"],
          city: "Khalapur",
          locality: "Expressway Mall, Khalapur",
          isOpen: true,
          isTrending: true,
          reviewCount: 4500,
          priceRange: "$$",
          distance: 0,
          hours: { open: "00:00", close: "23:59" },
        });
      } else if (index === 4) {
        stops.push({
          id: `pm-stop-khopoli-dhaba-${index}`,
          title: "Sartaj Punjabi Highway Dhaba",
          description: "Delicious butter chicken, sizzling hot tandoori rotis, and refreshing lassi. Perfect pitstop for a hearty late-night meal.",
          category: "restaurant",
          image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=420&fit=crop",
          rating: 4.4,
          latitude: stopLat,
          longitude: stopLng,
          tags: ["highway-stop", "restaurant", "punjabi-dhaba", "late-night", "toilet"],
          city: "Khopoli",
          locality: "NH48 Khopoli Bypass",
          isOpen: true,
          isTrending: false,
          reviewCount: 650,
          priceRange: "₹₹",
          distance: 0,
          hours: { open: "11:00", close: "03:00" },
        });
      } else if (index === 5) {
        stops.push({
          id: `pm-stop-rasayani-${index}`,
          title: "Rasayani Smart E-Toilet Hub",
          description: "Ultra-clean, state-of-the-art automatic e-toilets. Zero-contact, coin-operated, with fully sanitized air-conditioned cubicles.",
          category: "event",
          image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&h=420&fit=crop",
          rating: 4.9,
          latitude: stopLat,
          longitude: stopLng,
          tags: ["toilet", "highway-stop", "smart-toilet", "restroom"],
          city: "Rasayani",
          locality: "Rasayani Rest Area",
          isOpen: true,
          isTrending: true,
          reviewCount: 180,
          priceRange: "₹5",
          distance: 0,
          hours: { open: "00:00", close: "23:59" },
        });
      } else {
        stops.push({
          id: `pm-stop-panvel-${index}`,
          title: "Tata Power EV Hub - Panvel Gateway",
          description: "Large-capacity EV hub featuring four 50kW CCS2 fast chargers. Located adjacent to modular food kiosks and air-conditioned restrooms.",
          category: "event",
          image: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600&h=420&fit=crop",
          rating: 4.7,
          latitude: stopLat,
          longitude: stopLng,
          tags: ["ev-station", "highway-stop", "fast-charge", "toilet"],
          city: "Panvel",
          locality: "NH48 Panvel Entry",
          isOpen: true,
          isTrending: false,
          reviewCount: 320,
          priceRange: "₹18/kWh",
          distance: 0,
          hours: { open: "00:00", close: "23:59" },
        });
      }
    } else {
      // General highway stops generator for custom driving routes
      const names = [
        "Highway EV Charging Hub",
        "Classic Rest Stop & Eatery",
        "Scenic Valley View Point",
        "Expressway Food Plaza",
        "Clean Sulabh Restroom",
        "Tata Power EV Station",
        "Green Valley Scenic Stop",
      ];

      const descriptions = [
        "Jio-bp Pulse electric vehicle fast charging station with two 50kW chargers. Features clean modern restrooms and refreshments.",
        "Delicious hot vada pav, piping tea, and authentic local highway snacks. Equipped with guest washrooms.",
        "Beautiful scenic viewing point with spectacular landscape views. Ideal for photographic memories and resting.",
        "A premium highway food plaza with quick service food counters, coffee shops, and fully sanitized washrooms.",
        "Well-maintained public restrooms with active cleaning staff, hand sanitizers, and basic changing facilities.",
        "Tata Power charging spot with multiple CCS2 connectors. Located near a convenience store and café.",
        "Peaceful highway rest overlook facing rolling hills. Features park benches and quick tea stalls.",
      ];

      const tags = [
        ["ev-station", "highway-stop", "fast-charge", "toilet"],
        ["food-stall", "highway-stop", "local-food", "toilet"],
        ["viewpoint", "highway-stop", "scenic"],
        ["restaurant", "highway-stop", "food-plaza", "toilet"],
        ["toilet", "highway-stop", "restroom"],
        ["ev-station", "highway-stop", "fast-charge"],
        ["viewpoint", "highway-stop", "scenic", "tea"],
      ];

      const categories = ["event", "food-stall", "event", "restaurant", "event", "event", "event"];

      const images = [
        "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600&h=420&fit=crop",
        "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=420&fit=crop",
        "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=600&h=420&fit=crop",
        "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&h=420&fit=crop",
        "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&h=420&fit=crop",
        "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600&h=420&fit=crop",
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&h=420&fit=crop",
      ];

      const chosenIdx = index % names.length;
      stops.push({
        id: `gen-stop-${index}-${chosenIdx}`,
        title: `${names[chosenIdx]} #${index + 1}`,
        description: descriptions[chosenIdx],
        category: categories[chosenIdx] as any,
        image: images[chosenIdx],
        rating: parseFloat((4.3 + index * 0.1 - (index % 3) * 0.05).toFixed(1)),
        latitude: stopLat,
        longitude: stopLng,
        tags: tags[chosenIdx],
        city: "Highway",
        locality: `KM Milestone ${Math.round(20 * (index + 1))}`,
        isOpen: true,
        isTrending: index % 3 === 0,
        reviewCount: Math.round(150 + index * 45),
        priceRange: tags[chosenIdx].includes("ev-station")
          ? "₹16/kWh"
          : tags[chosenIdx].includes("toilet")
          ? "₹5"
          : "₹",
        distance: 0,
        hours: { open: "06:00", close: "23:00" },
      });
    }
  });

  return stops;
}
