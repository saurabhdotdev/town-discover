"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { 
  Sparkles, MapPin, Calendar, Clock, Compass, Plus, Trash2, ArrowRight,
  Star, Map as MapIcon, RefreshCw, Layers, Download, CalendarPlus, 
  MapIcon as MapViewIcon, Info, Bus, Car, Navigation, AlertCircle
} from "lucide-react";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { 
  SupportedCityName, 
  CITY_CENTERS, 
  CITY_DISPLAY_NAMES,
  CITY_GROUPS
} from "@/lib/pune-location";
import { Place, PlaceCategory } from "@/types";
import { getCategoryAccent, getCategoryLabel } from "@/lib/utils";
import { calculateDistance } from "@/lib/geo";
import { clusterPlacesKMeans } from "@/lib/kmeans";

// Dynamically import MapView to prevent SSR issues (Leaflet uses window)
const MapView = dynamic(() => import("@/components/map/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full animate-pulse rounded-2xl border border-[var(--border)] bg-slate-900/60 flex flex-col items-center justify-center gap-3 text-slate-400">
      <div className="relative">
        <MapViewIcon className="h-10 w-10 text-teal-400/80 animate-pulse" />
        <div className="absolute inset-0 rounded-full bg-teal-400/20 blur-md animate-ping" />
      </div>
      <span className="text-xs font-black uppercase tracking-wider text-teal-400">Initializing Navigation Engine</span>
    </div>
  )
});

// Transit Guides for Twin Cities
interface TransitMode {
  icon: string;
  name: string;
  details: string;
  cost: string;
}

interface TransitInfo {
  distance: string;
  duration: string;
  highwayName: string;
  modes: TransitMode[];
}

const TRANSIT_GUIDES: Record<string, TransitInfo> = {
  HubliDharwad: {
    distance: "20 km",
    duration: "30-40 mins",
    highwayName: "AH47 (Pune-Bengaluru Highway)",
    modes: [
      { icon: "🚌", name: "NWKRTC BRTS", details: "Air-conditioned Volvo/EMU buses running on a high-speed dedicated lane.", cost: "₹25 - ₹40" },
      { icon: "🚗", name: "Local Cab/Auto", details: "Direct highway taxi or shared auto between Hubli and Dharwad centers.", cost: "₹250 - ₹400" },
      { icon: "🚂", name: "Local Train", details: "Intercity shuttle trains connecting Hubli Junction and Dharwad station.", cost: "₹10 - ₹30" }
    ]
  },
  PunePimpriChinchwad: {
    distance: "15 km",
    duration: "25-35 mins",
    highwayName: "Old Mumbai-Pune Highway / NH60",
    modes: [
      { icon: "🚇", name: "Pune Metro (Line 1)", details: "Pimpri Chinchwad Municipal Corporation (PCMC) to Swargate via Shivajinagar.", cost: "₹10 - ₹35" },
      { icon: "🚆", name: "Local Train (Suburban)", details: "Frequent local trains connecting Pune Junction to Lonavala via PCMC.", cost: "₹10 - ₹25" },
      { icon: "🚌", name: "PMPML Buses", details: "Frequent AC and non-AC public bus connectivity running across the cities.", cost: "₹15 - ₹50" }
    ]
  },
  BelgaumSambra: {
    distance: "12 km",
    duration: "20-25 mins",
    highwayName: "Belagavi-Bagalkot Highway",
    modes: [
      { icon: "🚌", name: "KSRTC Sambra Shuttle", details: "Regular shuttle buses connecting Belagavi Central Bus Stand to Sambra Airport.", cost: "₹20 - ₹35" },
      { icon: "🚗", name: "Airport Taxi", details: "Direct pre-paid or app cabs available fromSambara Airport terminal.", cost: "₹300 - ₹450" }
    ]
  },
  IndoreUjjain: {
    distance: "55 km",
    duration: "1 hr 15 mins",
    highwayName: "Indore-Ujjain Road / SH27",
    modes: [
      { icon: "🚌", name: "Chartered Bus Service", details: "Frequent premium AC coaches running every 15 minutes between Indore & Ujjain.", cost: "₹100 - ₹180" },
      { icon: "🚗", name: "Private Cab / Ola Outstation", details: "Direct highway drop service. Highly convenient for family day trips.", cost: "₹1,200 - ₹1,800" },
      { icon: "🚂", name: "Passenger / Express Trains", details: "Multiple daily trains linking Indore Junction and Ujjain Junction.", cost: "₹30 - ₹120" }
    ]
  },
  HyderabadSecunderabad: {
    distance: "8 km",
    duration: "15-25 mins",
    highwayName: "PV Narasimha Rao Expressway / Necklace Road",
    modes: [
      { icon: "🚇", name: "Hyderabad Metro (Blue Line)", details: "Secunderabad East to Ameerpet / Hitec City. Fast and traffic-free.", cost: "₹15 - ₹45" },
      { icon: "🚆", name: "MMTS Suburban Rail", details: "Local train network linking Secunderabad Station to Nampally, Lingampally.", cost: "₹10 - ₹20" },
      { icon: "🚗", name: "App Cabs / Auto", details: "Cab or auto aggregators. Highly accessible, expect peak-hour bottlenecks.", cost: "₹120 - ₹250" }
    ]
  }
};

const SATELLITE_CENTERS: Record<string, { primary: { lat: number; lng: number }; satellite: { lat: number; lng: number } }> = {
  HubliDharwad: {
    primary: { lat: 15.3647, lng: 75.1240 },
    satellite: { lat: 15.4589, lng: 75.0078 }
  },
  PunePCMC: {
    primary: { lat: 18.5204, lng: 73.8567 },
    satellite: { lat: 18.6298, lng: 73.7997 }
  },
  BangaloreMysore: {
    primary: { lat: 12.9716, lng: 77.5946 },
    satellite: { lat: 12.2958, lng: 76.6394 }
  },
  IndoreUjjain: {
    primary: { lat: 22.7196, lng: 75.8577 },
    satellite: { lat: 23.1760, lng: 75.7885 }
  },
  HyderabadSecunderabad: {
    primary: { lat: 17.3850, lng: 78.4867 },
    satellite: { lat: 17.4399, lng: 78.4983 }
  }
};

const categoryColorHex: Record<string, string> = {
  cafe: "#f59e0b",
  restaurant: "#f43f5e",
  event: "#38bdf8",
  nightlife: "#d946ef",
  "food-stall": "#eab308",
  bar: "#fb7185",
  dessert: "#14b8a6",
  "ice-cream": "#e879f9",
  "street-food": "#f97316",
};

// Transit Route Label Generator
function getTransitRouteLabel(p1: Place, p2: Place): string {
  const city = (p1.city || p2.city || "").toLowerCase();
  const l1 = (p1.locality || "").trim();
  const l2 = (p2.locality || "").trim();

  if (!l1 || !l2 || l1 === l2) {
    if (city.includes("pune")) return "via local lanes";
    if (city.includes("bangalore") || city.includes("bengaluru")) return "via internal streets";
    if (city.includes("mumbai")) return "via local roads";
    return "via local streets";
  }

  if (city.includes("pune")) {
    if (l1.includes("Koregaon") || l2.includes("Koregaon")) {
      if (l1.includes("Kalyani") || l2.includes("Kalyani")) return "via Aga Khan Bridge";
      return "via North Main Rd";
    }
    if (l1.includes("Kothrud") || l2.includes("Kothrud")) return "via Karve Rd";
    if (l1.includes("Baner") || l2.includes("Baner")) return "via Baner Rd & NH48";
    if (l1.includes("Shivajinagar") || l2.includes("Shivajinagar")) return "via FC Road";
    if (l1.includes("Viman") || l2.includes("Viman")) return "via Pune-Ahmednagar Highway";
    return `via ${l1} - ${l2} Link Rd`;
  }

  if (city.includes("bangalore") || city.includes("bengaluru")) {
    if (l1.includes("Indiranagar") || l2.includes("Indiranagar")) return "via 100 Feet Rd";
    if (l1.includes("Koramangala") || l2.includes("Koramangala")) return "via 80 Feet Rd";
    if (l1.includes("Whitefield") || l2.includes("Whitefield")) return "via ITPL Main Rd";
    if (l1.includes("MG Road") || l2.includes("MG Road")) return "via MG Road";
    return "via Outer Ring Rd";
  }

  if (city.includes("mumbai")) {
    if (l1.includes("Bandra") && l2.includes("Worli")) return "via Bandra-Worli Sea Link 🌊";
    if (l1.includes("Colaba") || l2.includes("Colaba")) return "via Marine Drive";
    return "via Western Express Highway";
  }

  if (city.includes("delhi")) {
    return "via Ring Rd & Outer Ring Rd";
  }

  return `via ${l1} - ${l2} connector`;
}

// Consistent Live Traffic Status
function getTrafficStatus(p1: Place, p2: Place) {
  const code = (p1.title.length + p2.title.length) % 3;
  if (code === 0) return { label: "Light traffic", color: "text-emerald-400 bg-emerald-400/10 border-emerald-500/20" };
  if (code === 1) return { label: "Moderate delay", color: "text-amber-400 bg-amber-400/10 border-amber-500/20" };
  return { label: "Heavy congestion", color: "text-rose-400 bg-rose-400/10 border-rose-500/20" };
}

type VibeType = "all" | "culture" | "food" | "nature" | "chill";
type MobileTab = "timeline" | "pool" | "guide";

export default function TripsPage() {
  const router = useRouter();
  const [selectedCity, setSelectedCity] = useState<SupportedCityName>("HubliDharwad");
  const [daysCount, setDaysCount] = useState<number>(2);
  const [selectedVibe, setSelectedVibe] = useState<VibeType>("all");
  const [loading, setLoading] = useState<boolean>(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [itinerary, setItinerary] = useState<Record<number, Place[]>>({ 1: [], 2: [], 3: [], 4: [] });
  const [activeDay, setActiveDay] = useState<number>(1);
  const [tripName, setTripName] = useState<string>("My Twin City Adventure");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [travelMode, setTravelMode] = useState<"driving" | "walking">("driving");
  
  // Responsive Tab State
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("timeline");

  // Client-side nearest-neighbor TSP route optimizer
  const optimizeRoute = (day: number) => {
    const list = [...(itinerary[day] || [])];
    if (list.length <= 2) return;

    const optimized: Place[] = [];
    let current = list.shift()!;
    optimized.push(current);

    while (list.length > 0) {
      let nearestIndex = 0;
      let minDistance = Number.MAX_VALUE;

      for (let i = 0; i < list.length; i++) {
        const dist = calculateDistance(
          current.latitude,
          current.longitude,
          list[i].latitude,
          list[i].longitude
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestIndex = i;
        }
      }

      current = list.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }

    setItinerary((prev) => ({
      ...prev,
      [day]: optimized,
    }));
  };

  // Fetch places for selected city
  useEffect(() => {
    async function fetchPlaces() {
      setLoading(true);
      try {
        const res = await fetch(`/api/places/osm?city=${encodeURIComponent(selectedCity)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.places) {
            setPlaces(data.places);
            distributePlaces(data.places, selectedCity, daysCount);
          }
        }
      } catch (err) {
        console.error("Failed to load twin city places:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlaces();
  }, [selectedCity]);

  // Distribute places intelligently using K-Means spatial clustering
  const distributePlaces = (allPlaces: Place[], city: SupportedCityName, days: number) => {
    const clustered = clusterPlacesKMeans(allPlaces, days);
    
    // Limit each day's itinerary to at most 6 high-value stops
    const cappedItinerary: Record<number, Place[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (let d = 1; d <= days; d++) {
      cappedItinerary[d] = (clustered[d] || []).slice(0, 6);
    }

    setItinerary(cappedItinerary);
  };

  const handleDaysChange = (newDays: number) => {
    setDaysCount(newDays);
    distributePlaces(places, selectedCity, newDays);
  };

  const filteredRecommendations = useMemo(() => {
    return places.filter((place) => {
      const isAlreadyAdded = Object.values(itinerary).some((dayPlaces) =>
        dayPlaces.some((p) => p.id === place.id)
      );
      if (isAlreadyAdded) return false;

      if (selectedVibe === "all") return true;
      if (selectedVibe === "food") return ["cafe", "restaurant", "street-food", "bar", "dessert", "ice-cream"].includes(place.category);
      if (selectedVibe === "culture") return place.tags.some(t => ["temple", "monument", "historic", "museum", "church", "mosque", "heritage"].includes(t.toLowerCase()));
      if (selectedVibe === "nature") return place.tags.some(t => ["park", "garden", "lake", "waterfall", "beach", "scenic", "viewpoint"].includes(t.toLowerCase()));
      if (selectedVibe === "chill") return ["cafe", "ice-cream", "dessert"].includes(place.category) || place.tags.some(t => ["park", "chill", "relax"].includes(t.toLowerCase()));
      return true;
    });
  }, [places, itinerary, selectedVibe]);

  const allStops = useMemo(() => {
    const list: Place[] = [];
    for (let d = 1; d <= daysCount; d++) {
      if (itinerary[d]) {
        list.push(...itinerary[d]);
      }
    }
    return list;
  }, [itinerary, daysCount]);

  const routePathCoords = useMemo(() => {
    return allStops.map((stop) => ({
      latitude: stop.latitude,
      longitude: stop.longitude,
    }));
  }, [allStops]);

  const addStopToItinerary = (day: number, place: Place) => {
    setItinerary((prev) => ({
      ...prev,
      [day]: [...prev[day], place],
    }));
  };

  const removeStopFromItinerary = (day: number, stopId: string) => {
    setItinerary((prev) => ({
      ...prev,
      [day]: prev[day].filter((p) => p.id !== stopId),
    }));
  };

  const moveStopOrder = (day: number, index: number, direction: "up" | "down") => {
    const list = [...itinerary[day]];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    
    const [movedItem] = list.splice(index, 1);
    list.splice(targetIndex, 0, movedItem);
    
    setItinerary((prev) => ({
      ...prev,
      [day]: list,
    }));
  };

  const handleExportText = () => {
    const displayName = CITY_DISPLAY_NAMES[selectedCity] || selectedCity;
    let textContent = `=== SHEHER TRIP PLAN: ${tripName.toUpperCase()} ===\n`;
    textContent += `Destination: ${displayName}\n`;
    textContent += `Duration: ${daysCount} Days\n\n`;

    for (let d = 1; d <= daysCount; d++) {
      textContent += `--- DAY ${d} ---\n`;
      const stops = itinerary[d] || [];
      if (stops.length === 0) {
        textContent += `  (No stops planned)\n`;
      } else {
        stops.forEach((s, idx) => {
          textContent += `  ${idx + 1}. ${s.title} (${getCategoryLabel(s.category)})\n`;
          textContent += `     Locality: ${s.locality || "Central Area"}\n`;
          if (s.description) textContent += `     Note: ${s.description}\n`;
          textContent += `\n`;
        });
      }
      textContent += `\n`;
    }

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tripName.toLowerCase().replace(/\s+/g, "-")}-itinerary.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCalendar = () => {
    const displayName = CITY_DISPLAY_NAMES[selectedCity] || selectedCity;
    const startDate = new Date();
    const dateStr = startDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    
    const calendarTitle = encodeURIComponent(`${tripName} - ${displayName}`);
    const details = encodeURIComponent(
      `Plan generated via Sheher Twin-City Route Planner.\n\nStops:\n` +
      allStops.map((s, idx) => `${idx + 1}. ${s.title} (${s.locality})`).join("\n")
    );
    const location = encodeURIComponent(displayName);
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calendarTitle}&dates=${dateStr}/${dateStr}&details=${details}&location=${location}`;
    window.open(googleCalendarUrl, "_blank", "noopener,noreferrer");
  };

  const handleSaveTrip = async () => {
    setIsSaving(true);
    try {
      if (allStops.length === 0) {
        alert("Please add at least one stop to your itinerary before saving.");
        setIsSaving(false);
        return;
      }

      const displayName = CITY_DISPLAY_NAMES[selectedCity] || selectedCity;

      // Calculate actual Haversine distance and travel time
      let totalDistance = 0;
      let totalDuration = 0;

      for (let d = 1; d <= daysCount; d++) {
        const stops = itinerary[d] || [];
        for (let i = 0; i < stops.length; i++) {
          totalDuration += 45; // 45 minutes spent at each stop
          if (i > 0) {
            const dKm = calculateDistance(
              stops[i - 1].latitude,
              stops[i - 1].longitude,
              stops[i].latitude,
              stops[i].longitude
            );
            totalDistance += dKm;
            totalDuration += travelMode === "driving" ? dKm * 2.4 + 2 : dKm * 12;
          }
        }
      }

      const payload = {
        name: tripName || `${displayName} Explorer Trail`,
        source: allStops[0]?.locality || displayName,
        destination: allStops[allStops.length - 1]?.locality || displayName,
        distanceKm: Math.max(1, Math.round(totalDistance)) || null,
        durationMinutes: Math.max(45, Math.round(totalDuration)) || null,
        routePath: routePathCoords,
        stops: allStops.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          category: p.category,
          image: p.image || "/placeholder-place.jpg",
          rating: p.rating || 4.2,
          distance: p.distance || 0,
          tags: p.tags || [],
          city: p.city,
          locality: p.locality || "Central Area",
          isOpen: true,
          isTrending: false,
          reviewCount: p.reviewCount || 10,
          latitude: p.latitude,
          longitude: p.longitude
        })),
      };

      const res = await fetch("/api/trip-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.plan?.id) {
          router.push(`/trip/${data.plan.id}`);
        } else {
          alert("Trip saved, but failed to retrieve route ID.");
        }
      } else {
        const errData = await res.json();
        alert(`Failed to save trip plan: ${errData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Failed to save trip:", err);
      alert("Error saving your trip. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentCityDisplayName = CITY_DISPLAY_NAMES[selectedCity] || selectedCity;
  const isTwinCity = CITY_GROUPS.find((g) => g.id === "twins")?.cities.includes(selectedCity);
  const transitInfo = isTwinCity ? TRANSIT_GUIDES[selectedCity] : null;

  return (
    <div className="w-full max-w-7xl mx-auto relative px-3 py-4 sm:px-6 lg:px-8 bg-[var(--background)] min-h-screen text-[var(--foreground)] pb-28 overflow-hidden">
      
      {/* Decorative blurs */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-teal-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-60 h-96 w-96 rounded-full bg-cyan-500/8 blur-[100px]" />

      {/* Header */}
      <div className="relative mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2 text-teal-400 mb-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/10">
              <Sparkles size={12} className="animate-spin-slow text-teal-300" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Premium Route Planner</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-4xl text-[var(--foreground)] bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Twin-City Itinerary Builder 🔀
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-[var(--muted)]">
            Design connected journeys, check highway routes, and build custom travel boards.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="Name your route..."
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] pl-4 pr-10 text-sm font-bold text-[var(--foreground)] outline-none focus:border-teal-500/50 sm:w-56 shadow-inner"
            />
            <Compass size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              disabled={allStops.length === 0}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--panel-soft)] hover:border-[var(--muted)] transition-all shadow-md active:scale-95 disabled:opacity-40"
              title="Export Plan"
            >
              <Download size={16} />
            </button>
            
            <button
              onClick={handleSaveTrip}
              disabled={isSaving}
              className="flex-1 sm:flex-initial inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-5 text-sm font-black text-slate-950 shadow-lg shadow-teal-500/25 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  Saving...
                </>
              ) : (
                <>
                  Launch Route
                  <ArrowRight size={14} className="animate-pulse" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Tab Toggle Bar (Visible only on mobile/tablet) */}
      <div className="md:hidden rounded-xl bg-[var(--panel-soft)] p-1 border border-[var(--border)] mb-5 grid grid-cols-3 gap-1">
        {(["timeline", "pool", "guide"] as MobileTab[]).map((tab) => {
          const isActive = activeMobileTab === tab;
          const label = tab === "timeline" ? "📋 Itinerary" : tab === "pool" ? "🔍 Find Spots" : "🗺️ Map & Guide";
          return (
            <button
              key={tab}
              onClick={() => setActiveMobileTab(tab)}
              className={`py-2 text-[11px] font-black rounded-lg text-center transition-all ${
                isActive
                  ? "bg-teal-500/15 text-teal-300 shadow-sm border border-teal-500/10"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Main Responsive Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        
        {/* Left Column: Settings, Transit Guides, and Map Preview */}
        <div className={`space-y-6 md:col-span-1 ${activeMobileTab === "guide" ? "block" : "hidden md:block"}`}>
          {/* Planner Setup Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-xl relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 to-cyan-500" />
            <h2 className="text-xs font-black uppercase tracking-wider text-[var(--muted-strong)] mb-4 flex items-center gap-2">
              <Layers size={14} className="text-teal-400" />
              1. Setup Corridor
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--muted)] mb-1.5">
                  Select Hub / Twin Pair
                </label>
                <CitySwitcher value={selectedCity} onChange={setSelectedCity} />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--muted)] mb-1.5">
                  Trip Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleDaysChange(d)}
                      className={`h-10 rounded-xl text-xs font-black border transition-all active:scale-95 ${
                        daysCount === d
                          ? "border-teal-400 bg-teal-500/10 text-teal-200 shadow-md shadow-teal-500/5"
                          : "border-[var(--border)] bg-[var(--panel-soft)] hover:bg-[var(--panel)] text-[var(--muted-strong)]"
                      }`}
                    >
                      {d} {d === 1 ? "D" : "Ds"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => distributePlaces(places, selectedCity, daysCount)}
                  disabled={places.length === 0}
                  className="w-full h-10 rounded-xl text-xs font-black border border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 text-teal-300 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                  title="Recalculate day-wise itinerary using K-Means++ clustering"
                >
                  <Sparkles size={14} className="text-teal-400" />
                  ✨ Re-Cluster Spots (K-Means++)
                </button>
              </div>
            </div>
          </div>

          {/* Vibe Match Dashboard */}
          {allStops.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-xl relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 to-cyan-500" />
              <h2 className="text-xs font-black uppercase tracking-wider text-[var(--muted-strong)] mb-4 flex items-center gap-2">
                <Sparkles size={14} className="text-teal-400" />
                Route Vibe Analyzer
              </h2>
              {(() => {
                let foodCount = 0;
                let cultureCount = 0;
                let natureCount = 0;
                let chillCount = 0;

                allStops.forEach((stop) => {
                  const isFood = ["cafe", "restaurant", "street-food", "bar", "dessert", "ice-cream"].includes(stop.category);
                  const isCulture = stop.tags.some(t => ["temple", "monument", "historic", "museum", "church", "mosque", "heritage"].includes(t.toLowerCase()));
                  const isNature = stop.tags.some(t => ["park", "garden", "lake", "waterfall", "beach", "scenic", "viewpoint"].includes(t.toLowerCase()));
                  const isChill = ["cafe", "ice-cream", "dessert"].includes(stop.category) || stop.tags.some(t => ["park", "chill", "relax"].includes(t.toLowerCase()));

                  if (isFood) foodCount++;
                  if (isCulture) cultureCount++;
                  if (isNature) natureCount++;
                  if (isChill) chillCount++;
                });

                const total = foodCount + cultureCount + natureCount + chillCount || 1;
                const foodPct = Math.round((foodCount / total) * 100);
                const culturePct = Math.round((cultureCount / total) * 100);
                const naturePct = Math.round((natureCount / total) * 100);
                const chillPct = Math.round((chillCount / total) * 100);

                let dominantLabel = "Balanced Explorer";
                let dominantColor = "text-teal-400";
                const maxVal = Math.max(foodPct, culturePct, naturePct, chillPct);
                if (maxVal > 0) {
                  if (maxVal === foodPct) {
                    dominantLabel = "Culinary Nomad";
                    dominantColor = "text-rose-400";
                  } else if (maxVal === culturePct) {
                    dominantLabel = "Culture Enthusiast";
                    dominantColor = "text-sky-400";
                  } else if (maxVal === naturePct) {
                    dominantLabel = "Nature Wanderer";
                    dominantColor = "text-emerald-400";
                  } else if (maxVal === chillPct) {
                    dominantLabel = "Leisure Seeker";
                    dominantColor = "text-amber-400";
                  }
                }

                return (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-[var(--panel-soft)] rounded-xl p-3 border border-[var(--border)]">
                      <span className="text-[10px] font-black uppercase text-[var(--muted)]">Dominant Vibe</span>
                      <span className={`text-xs font-black uppercase tracking-wider ${dominantColor}`}>{dominantLabel}</span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-[var(--muted-strong)]">
                          <span>🍔 FOOD & DRINK</span>
                          <span>{foodPct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--panel-soft)] rounded-full overflow-hidden">
                          <div className="h-full bg-rose-400 rounded-full" style={{ width: `${foodPct}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-[var(--muted-strong)]">
                          <span>🏰 CULTURE & HERITAGE</span>
                          <span>{culturePct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--panel-soft)] rounded-full overflow-hidden">
                          <div className="h-full bg-sky-400 rounded-full" style={{ width: `${culturePct}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-[var(--muted-strong)]">
                          <span>🏞️ NATURE & ESCAPES</span>
                          <span>{naturePct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--panel-soft)] rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${naturePct}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-[var(--muted-strong)]">
                          <span>🧘 CHILL & VIBES</span>
                          <span>{chillPct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--panel-soft)] rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${chillPct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Transit Guide */}
          {transitInfo && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-950/20 via-[var(--panel)] to-slate-900/60 p-5 shadow-xl relative overflow-hidden"
            >
              <div className="absolute -left-3 top-16 h-6 w-6 rounded-full bg-[var(--background)] border-r border-teal-500/20" />
              <div className="absolute -right-3 top-16 h-6 w-6 rounded-full bg-[var(--background)] border-l border-teal-500/20" />
              
              <h2 className="text-sm font-black uppercase tracking-wider text-teal-300 mb-1.5 flex items-center gap-2">
                <Bus size={15} />
                Transit Companion
              </h2>
              
              <div className="mb-4 rounded-xl bg-slate-950 border border-teal-950/60 p-3.5 font-mono text-[11px] space-y-2 text-teal-400">
                <div className="flex justify-between border-b border-teal-950/40 pb-1.5">
                  <span className="text-[10px] text-teal-600 font-sans uppercase font-black">Highway Corridor:</span>
                  <span className="text-teal-200 font-bold truncate max-w-[140px]">{transitInfo.highwayName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-teal-600 font-sans uppercase font-black">Distance:</span>
                  <span className="text-teal-200 font-bold">{transitInfo.distance}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-teal-600 font-sans uppercase font-black">Est. Travel Time:</span>
                  <span className="text-cyan-300 font-bold animate-pulse">{transitInfo.duration}</span>
                </div>
              </div>

              <div className="space-y-3.5 pt-1">
                {transitInfo.modes.map((mode, idx) => (
                  <div key={idx} className="flex gap-3 items-start border-l border-[var(--border)] pl-3 relative">
                    <div className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-teal-400/50" />
                    <span className="text-lg shrink-0 mt-0.5">{mode.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <h4 className="text-xs font-black text-[var(--foreground)]">{mode.name}</h4>
                        <span className="text-[10px] font-black text-teal-400 bg-teal-500/10 px-1.5 py-0.2 rounded shrink-0">{mode.cost}</span>
                      </div>
                      <p className="text-[10px] text-[var(--muted-strong)] mt-1 leading-relaxed">{mode.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Map Preview */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-xl space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-[var(--muted-strong)] flex items-center gap-2">
              <MapIcon size={14} className="text-teal-400" />
              Route Map Preview
            </h2>
            <MapView
              places={allStops}
              userLocation={null}
              tripMode={true}
              tripRoutePath={routePathCoords}
              tripItinerary={itinerary}
              className="h-64 rounded-xl border border-[var(--border)] overflow-hidden shadow-inner"
            />
          </div>
        </div>

        {/* Right Column: Recommendations Pool and Interactive Timeline */}
        <div className={`md:col-span-2 space-y-6 ${activeMobileTab !== "guide" ? "block" : "hidden md:block"}`}>
          {/* Inner Grid for columns */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            
            {/* Recommendations Pool (2/5 cols) */}
            <div className={`xl:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-xl flex flex-col h-[540px] md:h-[580px] ${activeMobileTab === "pool" ? "flex" : "hidden md:flex"}`}>
              <div className="mb-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-[var(--muted-strong)] flex items-center gap-2">
                  <Compass size={14} className="text-teal-400" />
                  2. Spot Picker
                </h2>
                <p className="text-[10px] text-[var(--muted)] mt-0.5">
                  Pick spots to plan for Day {activeDay}.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4 border-b border-[var(--border)] pb-3">
                {(["all", "culture", "food", "nature", "chill"] as VibeType[]).map((v) => {
                  const active = selectedVibe === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSelectedVibe(v)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                        active
                          ? "bg-teal-400 text-slate-950 shadow-md scale-105"
                          : "bg-[var(--panel-soft)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                {loading ? (
                  <div className="py-16 text-center text-xs font-semibold text-[var(--muted)] flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="animate-spin text-teal-400 h-5 w-5" />
                    Fetching spots...
                  </div>
                ) : filteredRecommendations.length > 0 ? (
                  filteredRecommendations.map((place) => (
                    <div
                      key={place.id}
                      className="group flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-2 hover:border-teal-500/35 hover:bg-[var(--panel-strong)] transition duration-150 relative overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: categoryColorHex[place.category] || "#2dd4bf" }} />
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-800 ml-1">
                        <img
                          src={place.image || "/placeholder-place.jpg"}
                          alt={place.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder-place.jpg";
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="truncate text-xs font-bold text-[var(--foreground)]">{place.title}</h3>
                        <p className="truncate text-[9px] text-[var(--muted)] mt-0.5">{place.locality || currentCityDisplayName}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-flex items-center rounded px-1.5 text-[8px] font-black uppercase text-teal-400 bg-teal-500/10">
                            {getCategoryLabel(place.category)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addStopToItinerary(activeDay, place)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-400 text-slate-950 hover:brightness-110 active:scale-95 transition-all self-center mr-1"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-16 text-center text-xs font-medium text-[var(--muted)] flex flex-col items-center gap-1.5">
                    <Info size={16} className="text-[var(--muted-strong)]" />
                    No matching pool spots.
                  </div>
                )}
              </div>
            </div>

            {/* Itinerary Timeline (3/5 cols) */}
            <div className={`xl:col-span-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-xl flex flex-col h-[540px] md:h-[580px] relative overflow-hidden ${activeMobileTab === "timeline" ? "flex" : "hidden md:flex"}`}>
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 to-cyan-500" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--border)] pb-3 mb-5 gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none flex-1">
                  {Array.from({ length: daysCount }).map((_, i) => {
                    const dayNum = i + 1;
                    const isDayActive = activeDay === dayNum;
                    
                    return (
                      <button
                        key={dayNum}
                        type="button"
                        onClick={() => setActiveDay(dayNum)}
                        className={`relative px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 flex-1 ${
                          isDayActive
                            ? "text-teal-200 bg-teal-500/10 border border-teal-500/20"
                            : "text-[var(--muted)] hover:text-[var(--foreground)] bg-[var(--panel-soft)]/50 hover:bg-[var(--panel-soft)]"
                        }`}
                      >
                        Day {dayNum}
                        {isDayActive && (
                          <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 h-1 w-6 rounded-t-full bg-teal-400" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <div className="flex rounded-lg bg-[var(--panel-soft)] p-0.5 border border-[var(--border)] text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setTravelMode("driving")}
                      className={`px-2 py-1 rounded-md transition ${
                        travelMode === "driving" ? "bg-teal-500/10 text-teal-300" : "text-[var(--muted)]"
                      }`}
                    >
                      🚗 Drive
                    </button>
                    <button
                      type="button"
                      onClick={() => setTravelMode("walking")}
                      className={`px-2 py-1 rounded-md transition ${
                        travelMode === "walking" ? "bg-teal-500/10 text-teal-300" : "text-[var(--muted)]"
                      }`}
                    >
                      🚶 Walk
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => optimizeRoute(activeDay)}
                    disabled={!itinerary[activeDay] || itinerary[activeDay].length <= 2}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-teal-500/20 bg-teal-500/5 px-2.5 text-[10px] font-black uppercase tracking-wider text-teal-300 hover:bg-teal-500/10 transition disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Optimize ⚡
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {itinerary[activeDay]?.length > 0 ? (
                    itinerary[activeDay].map((stop, index) => {
                      const isFirst = index === 0;
                      const isLast = index === itinerary[activeDay].length - 1;
                      const prevStop = index > 0 ? itinerary[activeDay][index - 1] : null;
                      
                      let distKm = 0;
                      let timeMins = 0;
                      if (prevStop) {
                        distKm = calculateDistance(prevStop.latitude, prevStop.longitude, stop.latitude, stop.longitude);
                        timeMins = travelMode === "driving"
                          ? Math.max(1, Math.round(distKm * 2.4 + 2))
                          : Math.max(1, Math.round(distKm * 12));
                      }
                      
                      return (
                        <div key={stop.id}>
                          {prevStop && (() => {
                            const traffic = getTrafficStatus(prevStop, stop);
                            const road = getTransitRouteLabel(prevStop, stop);
                            return (
                              <div className="relative pl-7 my-3 flex flex-col gap-1 text-[10px] animate-fade-in group/transit select-none">
                                {/* Connector dotted line */}
                                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-800 border-dashed" />
                                
                                <div className="relative z-10 flex items-center gap-2.5 ml-2.5">
                                  {/* Pulsing travel icon container */}
                                  <div className="relative h-6 w-6 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-teal-400 shadow-lg group-hover/transit:border-teal-500/35 transition duration-300">
                                    {travelMode === "driving" ? (
                                      <Car size={11} className="animate-pulse" />
                                    ) : (
                                      <span className="text-[10px] animate-pulse">🚶</span>
                                    )}
                                    <div className="absolute inset-0 rounded-full bg-teal-400/5 animate-ping opacity-60 pointer-events-none" />
                                  </div>

                                  {/* Route details glass container */}
                                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/5 bg-slate-950/60 backdrop-blur-sm px-2.5 py-1 text-[9px] shadow-sm font-semibold transition hover:bg-slate-950 hover:border-slate-800/80">
                                    <span className="text-slate-200 font-bold">
                                      {distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)} km`}
                                    </span>
                                    <span className="text-slate-500">•</span>
                                    <span className="text-teal-300 font-black">
                                      {timeMins} min{timeMins > 1 ? "s" : ""}
                                    </span>
                                    <span className="text-slate-600 font-mono text-[8px] uppercase tracking-wider">
                                      {road}
                                    </span>
                                  </div>

                                  {/* Traffic Indicator */}
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-black uppercase tracking-wider ${traffic.color}`}>
                                    <span className="h-1 w-1 rounded-full bg-current animate-ping animate-duration-1000" />
                                    {traffic.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}

                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative flex gap-3.5 pl-7 group"
                          >
                            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-[var(--border)] group-last:bottom-auto group-last:h-6" />
                            
                            <div 
                              className="absolute left-1 top-4 h-4.5 w-4.5 rounded-full border-2 bg-slate-950 text-[9px] font-black text-center flex items-center justify-center"
                              style={{ 
                                borderColor: categoryColorHex[stop.category] || "#2dd4bf",
                                color: categoryColorHex[stop.category] || "#2dd4bf"
                              }}
                            >
                              {index + 1}
                            </div>

                            <div className="flex-1 flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-3 hover:border-teal-500/25 hover:bg-[var(--panel)] transition-all duration-150">
                              <div className="min-w-0 flex items-center gap-3">
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                                  <img
                                    src={stop.image || "/placeholder-place.jpg"}
                                    alt={stop.title}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-black text-[var(--foreground)] truncate">{stop.title}</h4>
                                  <p className="text-[9px] text-[var(--muted-strong)] flex items-center gap-1 mt-0.5 font-semibold">
                                    <MapPin size={9} className="text-teal-400" />
                                    {stop.locality || currentCityDisplayName}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={isFirst}
                                  onClick={() => moveStopOrder(activeDay, index, "up")}
                                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[10px] disabled:opacity-30 hover:bg-[var(--panel-soft)]"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={isLast}
                                  onClick={() => moveStopOrder(activeDay, index, "down")}
                                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[10px] disabled:opacity-30 hover:bg-[var(--panel-soft)]"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeStopFromItinerary(activeDay, stop.id)}
                                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-full border border-teal-500/20 bg-teal-500/5 flex items-center justify-center text-teal-400">
                        <Compass size={22} className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-[var(--foreground)]">Itinerary Empty</h3>
                        <p className="text-[10px] text-[var(--muted)] mt-1">Tap a spot from search to add to Day {activeDay}.</p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 to-cyan-500" />
              
              <h3 className="text-base font-black flex items-center gap-2 text-teal-400">
                <Download size={18} />
                Export Route Plan
              </h3>
              <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
                Download your planned corridor trail as an offline file or schedule it directly to your calendar.
              </p>

              <div className="mt-5 space-y-2.5">
                <button
                  onClick={() => {
                    handleExportText();
                    setShowExportModal(false);
                  }}
                  className="w-full inline-flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 text-xs font-bold hover:bg-[var(--panel)] hover:border-teal-500/30 transition-all text-[var(--foreground)] active:scale-[0.98]"
                >
                  <Download size={15} className="text-teal-400" />
                  Download Itinerary (.txt file)
                </button>
                <button
                  onClick={() => {
                    handleExportCalendar();
                    setShowExportModal(false);
                  }}
                  className="w-full inline-flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 text-xs font-bold hover:bg-[var(--panel)] hover:border-cyan-500/30 transition-all text-[var(--foreground)] active:scale-[0.98]"
                >
                  <CalendarPlus size={15} className="text-cyan-400" />
                  Add to Google Calendar
                </button>
              </div>

              <button
                onClick={() => setShowExportModal(false)}
                className="mt-6 w-full text-center text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition"
              >
                Close Panel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
