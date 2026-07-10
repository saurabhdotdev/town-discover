"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { motion, Reorder } from "framer-motion";
import { Header } from "@/components/common/Header";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { LocationPermissionCard } from "@/components/common/LocationPermissionCard";
import dynamic from "next/dynamic";
import { useCitySelection } from "@/hooks/useCitySelection";
import { useLivePlacesByBounds } from "@/hooks/useLivePlacesByBounds";
import { useGeolocation } from "@/hooks/useGeolocation";
import { getPlacesWithDistance } from "@/data/mock-places";
import { getFallbackPlacesForCity } from "@/lib/client/fallback-places";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { Place } from "@/types";
import { MapSkeleton } from "@/components/common/Skeleton";
import { useRouter } from "next/navigation";

const MapView = dynamic(() => import("@/components/map/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => <MapSkeleton />
});
import { Clock, Copy, LocateFixed, Map, MapPin, Star, Play, Pause, Square, FastForward, Navigation, ShieldAlert, Save, Share2, Eye, EyeOff, Trash2, GripVertical, ArrowUp, ArrowDown, ChevronRight, X, Sun, CloudRain, Cloud, ThermometerSnowflake, Sparkles, Plane, ShoppingBag, Bed, Coffee, Compass, Utensils, Moon, Store, GlassWater, Cake, IceCream, Soup, Heart, Car } from "lucide-react";
import { cn, formatDistance, formatPlaceArea, getCategoryLabel, isOpenNow, isVegetarianPlace, API_URL } from "@/lib/utils";
import { io } from "socket.io-client";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import { LazyImage } from "@/components/common/LazyImage";
import { getCityWeather, filterPlacesByWeather } from "@/lib/weather";

import { combineLiveAndCuratedPlaces } from "@/lib/combine-places";
import { CITY_CENTERS } from "@/lib/pune-location";
import { SuggestPlaceModal } from "@/components/map/SuggestPlaceModal";
import { geocodePlace, generateStopsAlongRoute, ROUTE_PRESETS } from "@/lib/client/trip-utils";
import { calculateDistance } from "@/lib/geo";
import { useAuth } from "@/components/auth/AuthProvider";

interface SavedTripPlan {
  id: string;
  name: string;
  source: string;
  destination: string;
  distanceKm: number | null;
  durationMinutes: number | null;
  routePath: { latitude: number; longitude: number }[];
  stops: Place[];
  createdAt: string;
}

interface AirportRecommendation {
  title: string;
  description: string;
  location: string;
  isPremium?: boolean;
  couponCode?: string;
}

interface AirportGuide {
  name: string;
  city: string;
  terminal: string;
  loungeDiscountPercent?: number;
  layovers: {
    quick: AirportRecommendation[];
    medium: AirportRecommendation[];
    long: AirportRecommendation[];
  };
  lounges: {
    name: string;
    location: string;
    amenities: string[];
    premiumBenefit: string;
    couponCode?: string;
  }[];
}

const AIRPORT_GUIDES: Record<string, AirportGuide> = {
  PNQ: {
    name: "Pune Airport (Lohegaon)",
    city: "Pune",
    terminal: "New Integrated Terminal",
    loungeDiscountPercent: 50,
    layovers: {
      quick: [
        { title: "Chai Point Express", description: "Grab a piping hot traditional Elaichi Chai & bun maska in less than 3 minutes.", location: "Departure Gates, Area 2" },
        { title: "Charge Hub & Workspace", description: "Ergonomic charging bays and standing desks with free high-speed airport Wi-Fi.", location: "Near Gate 4" },
        { title: "Local Craft Souvenirs", description: "Quick window shopping for traditional brasswares and Puneri accessories.", location: "Retail Arcade" }
      ],
      medium: [
        { title: "Earth Lounge Access", description: "Relax on comfortable leather recliners with a gourmet hot buffet spread.", location: "First Floor, Departure Area", isPremium: true, couponCode: "SHEHER_PNQ_EARTH" },
        { title: "The Coffee Bean & Tea Leaf", description: "Sip an ice-blended coffee while reading book selections at the library shelf.", location: "Security Hold Area" },
        { title: "Pavers England", description: "Browse and try premium hand-stitched leather footwear and traveling accessories.", location: "Retail Boulevard" }
      ],
      long: [
        { title: "Aroma Wellness & Reflexology", description: "Indulge in a 30-minute express foot reflexology or back massage to de-stress.", location: "Near Gate 6", isPremium: true, couponCode: "SPA_SHEHER_30" },
        { title: "Silent resting alcoves", description: "Rest in quiet relaxation chairs with dim lighting away from boarding announcements.", location: "Upper Level, opposite Gate 8" }
      ]
    },
    lounges: [
      {
        name: "Earth Lounge",
        location: "First Floor, near gate 3",
        amenities: ["Gourmet Buffet", "Free High-Speed Wi-Fi", "Charging Stations", "Flight Monitors"],
        premiumBenefit: "Free Entry + Dedicated Lounge Pass with Sheher Premium Pass",
        couponCode: "SHEHER-PNQ-LOUNGE"
      }
    ]
  },
  BOM: {
    name: "Chhatrapati Shivaji Maharaj International Airport (T2)",
    city: "Mumbai",
    terminal: "Terminal 2 - Luxury Hub",
    loungeDiscountPercent: 50,
    layovers: {
      quick: [
        { title: "Jaya He Museum Walk", description: "India's largest public art program. Explore 5,500+ stunning historical artifacts spanning a 3km walkway.", location: "Departures Level 3 & 4" },
        { title: "Third Wave Coffee Roasters", description: "Quick hand-brewed single-origin Pour Over coffee.", location: "Domestic Departures, Gate 45" },
        { title: "Scentido Luxury Perfumery", description: "Try exotic niche perfumes from around the globe.", location: "Duty Free Walkway" }
      ],
      medium: [
        { title: "Adani Lounge (Luxury Class)", description: "Ultra-luxury airport lounge experience with five-star live cooking stations and custom cocktail mixers.", location: "Level 4, Departures", isPremium: true, couponCode: "SHEHER_BOM_ADANI" },
        { title: "Lotus Spa by O2", description: "Luxury body massage therapies, dry steam baths, and hot stone reflexology.", location: "Level 3, near Gate 64", isPremium: true, couponCode: "SPA_BOM_O2" },
        { title: "Forest Essentials Retail", description: "Indulge in pure Ayurvedic luxury skincare consultations and complimentary tester kits.", location: "Luxury Galleria" }
      ],
      long: [
        { title: "Niranta Transit Hotel & Lounge", description: "Rent a cozy hourly sleeping room, take a refreshing hot shower, and enjoy a premium buffet.", location: "Landside, Terminal 2", isPremium: true, couponCode: "NIRANTA_SHEHER_20" },
        { title: "Prana Spa & Salon Lounge", description: "Full beauty parlor, styling, hair treatments, and holistic massages.", location: "Departures Level 4" },
        { title: "Luxury Duty-Free Exploration", description: "Browse exclusive Single Malts, gourmet chocolates, and high-end watches with personal shopper assistance.", location: "Duty-Free Core" }
      ]
    },
    lounges: [
      {
        name: "Adani Lounge (Luxury Class)",
        location: "Level 4, T2 (Post-Security)",
        amenities: ["Live Chef Counters", "Premium Bar", "Shower Suites", "Massage Chairs", "Business Center"],
        premiumBenefit: "Complimentary access for Sheher Pass holders (Valid once/quarter)",
        couponCode: "SHEHER-BOM-ADANI-VIP"
      }
    ]
  },
  BLR: {
    name: "Kempegowda International Airport (T2)",
    city: "Bengaluru",
    terminal: "Terminal 2 - Terminal in a Garden",
    loungeDiscountPercent: 50,
    layovers: {
      quick: [
        { title: "T2 Forest Walkway", description: "Walk through the stunning indoor bamboo gardens, moss walls, and hanging plant bells.", location: "T2 Transit Core" },
        { title: "Araku Coffee Experience", description: "Quick luxury organic espresso shot sourced from the Araku Valley.", location: "Departures Retail" },
        { title: "Tech charging pods", description: "Ergonomic charging capsules equipped with high-speed ports.", location: "Gate 12" }
      ],
      medium: [
        { title: "080 Lounge (Domestic/International)", description: "Premium Bengaluru-themed lounge featuring curated library rooms, cocktail bars, and chef counters.", location: "Level 2, Domestic Departures", isPremium: true, couponCode: "SHEHER_BLR_080" },
        { title: "Windmills Craftworks Bar", description: "Sip micro-brewed craft beers on tap while waiting for boarding calls.", location: "T2 Pier F", isPremium: true, couponCode: "WINDMILLS_FREE_BREW" },
        { title: "The Quad Mall Exploration", description: "Step just outside T1 to experience an outdoor plaza filled with live music, restaurants, and shopping stores.", location: "Arrivals Quad Plaza" }
      ],
      long: [
        { title: "Snooze At My Space Pods", description: "Soundproof sleeping pods with individual climate controls and work desk settings.", location: "T2, Near Gate 21", isPremium: true, couponCode: "SNOOZE_BLR_SHEHER" },
        { title: "O2 Spa Sanctuary", description: "Traditional Swedish therapy or deep tissue massages for complete relaxation.", location: "T2 Upper Level" }
      ]
    },
    lounges: [
      {
        name: "080 Lounge (Garden City Premium)",
        location: "T2 Departures, near Gate 15",
        amenities: ["Curated Library Room", "Whiskey Bar", "Live Wok & Pasta Counters", "Private Resting Cabins"],
        premiumBenefit: "Free access (subject to availability) + Priority Booking for Sheher Pass holders",
        couponCode: "SHEHER-BLR-080"
      }
    ]
  },
  DEL: {
    name: "Indira Gandhi International Airport (T3)",
    city: "Delhi",
    terminal: "Terminal 3 - Global Gateway",
    loungeDiscountPercent: 50,
    layovers: {
      quick: [
        { title: "Starbucks Reserve Experience", description: "Taste exclusive reserve blends in a highly stylish lounge cafe.", location: "T3 Retail Hub" },
        { title: "Charging Stations & Loungers", description: "Relax on reclining leather chairs with direct USB and AC outlets.", location: "Gates 27-36 Corridor" },
        { title: "Hamleys Toy Store Experience", description: "Fun, color-filled live displays and gadget testing counters.", location: "T3 Departures" }
      ],
      medium: [
        { title: "Encalm Lounge", description: "Massive lounge area with extensive culinary dishes, a live bar, and relaxing environments.", location: "Lounge Mezzanine Level", isPremium: true, couponCode: "SHEHER_DEL_ENCALM" },
        { title: "Encalm Spa Wellness", description: "Revitalizing aromatherapy treatments and fast foot massages.", location: "Lounge Level, T3", isPremium: true, couponCode: "SPA_DEL_ENCALM" },
        { title: "Delhi Bazaar Retail Walk", description: "Browse curated Indian spices, luxury teas, and hand-woven pashmina shawls.", location: "Duty Free Lane" }
      ],
      long: [
        { title: "SAM Snooze Pods", description: "Comfortable air-conditioned micro-hotel pods rented hourly with TV and Wi-Fi.", location: "International Departures, T3", isPremium: true, couponCode: "SAM_SNOOZE_DELHI" },
        { title: "Holiday Inn Express Transit Hotel", description: "Check in for an hourly room, get access to the fitness center and hot showers.", location: "Level 5, Departures T3", isPremium: true, couponCode: "HOLIDAY_IN_DELHI" }
      ]
    },
    lounges: [
      {
        name: "Encalm Lounge (T3 Mezzanine)",
        location: "Level 4, T3 Departures",
        amenities: ["Extensive International Buffet", "Bar Station", "Dedicated Workstations", "Wi-Fi & Magazines"],
        premiumBenefit: "100% Free Entry + Fast Track Lounge Check-In with Sheher Pass Card",
        couponCode: "SHEHER-DEL-ENCALM-VIP"
      }
    ]
  }
};

export default function MapPage() {
  const [mapWidth, setMapWidth] = useState(65); // default 65% width
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ("button" in e && e.button !== 0) return;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const newWidthPx = clientX - rect.left;
      let newWidthPercent = (newWidthPx / rect.width) * 100;
      
      // Constraint width between 30% and 80%
      if (newWidthPercent < 30) newWidthPercent = 30;
      if (newWidthPercent > 80) newWidthPercent = 80;
      
      setMapWidth(newWidthPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove);
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  const { user, setAuthRequiredMessage } = useAuth();
  const router = useRouter();
  const { selectedCity, hasChosenCity, chooseCity, preferDetectedCity } = useCitySelection();
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [isMobileCardCollapsed, setIsMobileCardCollapsed] = useState(false);
  const {
    location,
    loading: locationLoading,
    error: locationError,
    source: locationSource,
    city: detectedCity,
    liveTracking,
    requestLocation,
    toggleLiveTracking,
  } = useGeolocation();
  const activeCity = !hasChosenCity && locationSource === "browser" ? detectedCity : selectedCity;
  const activeLocation =
    locationSource === "browser" && location && activeCity === detectedCity ? location : CITY_CENTERS[activeCity];
  
  const [mapBounds, setMapBounds] = useState<{ south: number; west: number; north: number; east: number } | null>(null);

  const { places: livePlaces, loading: livePlacesLoading, error: livePlacesError } = useLivePlacesByBounds(
    mapBounds,
    activeCity
  );
  const [focusedPlace, setFocusedPlace] = useState<Place | null>(null);
  const [hideOtherPlaces, setHideOtherPlaces] = useState(false);
  const [detailsPlace, setDetailsPlace] = useState<Place | null>(null);
  const [injectedEventPlace, setInjectedEventPlace] = useState<Place | null>(null);

  useEffect(() => {
    if (!focusedPlace) {
      setHideOtherPlaces(false);
    }
  }, [focusedPlace]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showOnlyOpen, setShowOnlyOpen] = useState<boolean>(false);
  const [vegOnly, setVegOnly] = useState<boolean>(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [visiblePlacesCount, setVisiblePlacesCount] = useState(15);

  useEffect(() => {
    setVisiblePlacesCount(15);
  }, [selectedCategory, vegOnly, showOnlyOpen, minRating, activeCity]);
  const { savedPlaceIds, savedPlaces } = useSavedPlaces();

  // Sheher Trip Planner States
  const [mode, setMode] = useState<"explore" | "trip">("explore");
  const [tripSource, setTripSource] = useState<string>("Pune");
  const [tripDest, setTripDest] = useState<string>("Mumbai");
  const [tripRoutePath, setTripRoutePath] = useState<{ latitude: number; longitude: number }[] | null>(null);
  const [tripStops, setTripStops] = useState<Place[]>([]);
  const [selectedTripCategory, setSelectedTripCategory] = useState<"all" | "food" | "ev" | "toilet" | "scenic">("all");
  const [tripLoading, setTripLoading] = useState<boolean>(false);
  const [tripError, setTripError] = useState<string | null>(null);
  const [tripStats, setTripStats] = useState<{ distance: number; duration: number } | null>(null);
  const [tripPlanName, setTripPlanName] = useState<string>("");
  const [savedTripPlans, setSavedTripPlans] = useState<SavedTripPlan[]>([]);
  const [activeTripPlanId, setActiveTripPlanId] = useState<string | null>(null);
  const [tripSaveStatus, setTripSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [tripSaveMessage, setTripSaveMessage] = useState("");
  const [vehicleType, setVehicleType] = useState<"car" | "suv" | "lcv">("car");

  // Itinerary Sharing & Reordering States
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copyShareMessage, setCopyShareMessage] = useState("");

  // Airport Layover Companion States
  const [isAirportGuideOpen, setIsAirportGuideOpen] = useState(false);
  const [selectedAirportCode, setSelectedAirportCode] = useState<string>("BOM");
  const [layoverTimeBucket, setLayoverTimeBucket] = useState<"quick" | "medium" | "long">("medium");

  // Cruise Simulation States
  const [simulationActive, setSimulationActive] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(2); // 2x default
  const [simulationIndex, setSimulationIndex] = useState<number>(0);
  const [upcomingStopAlert, setUpcomingStopAlert] = useState<{ place: Place; distance: number } | null>(null);

  // Route Optimization & Weather States
  const [optimizationFeedback, setOptimizationFeedback] = useState<string | null>(null);
  const [simulatedDepartureHour, setSimulatedDepartureHour] = useState<number>(new Date().getHours());
  const [weatherAlternativeAlert, setWeatherAlternativeAlert] = useState<string | null>(null);

  // Flash Deal Notification States
  const [activeFlashDeal, setActiveFlashDeal] = useState<any | null>(null);

  const handlePlanTrip = async (startStr: string, endStr: string) => {
    if (!startStr.trim() || !endStr.trim()) {
      setTripError("Please fill in starting point and destination.");
      return;
    }
    setTripLoading(true);
    setTripError(null);
    setSimulationActive(false);
    setSimulationIndex(0);
    setFocusedPlace(null);
    
    try {
      const startCoord = await geocodePlace(startStr);
      const endCoord = await geocodePlace(endStr);
      
      if (!startCoord || !endCoord) {
        throw new Error("Unable to resolve locations. Try another spelling.");
      }

      const url = `https://router.project-osrm.org/route/v1/driving/${startCoord.longitude},${startCoord.latitude};${endCoord.longitude},${endCoord.latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("OSRM routing server connection error.");
      
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates) {
        throw new Error("No driving route found between these locations.");
      }

      const coords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng
      }));

      setTripRoutePath(coords);
      setTripStats({
        distance: Math.round(data.routes[0].distance / 1000),
        duration: Math.round(data.routes[0].duration / 60)
      });

      const stops = generateStopsAlongRoute(startCoord.name, endCoord.name, coords);
      setTripStops(stops);
      setTripPlanName(`${startCoord.name} to ${endCoord.name}`);
      setActiveTripPlanId(null);
      setTripSaveStatus("idle");
      setTripSaveMessage("");
    } catch (err: any) {
      setTripError(err.message || "An unexpected error occurred during route calculation.");
    } finally {
      setTripLoading(false);
    }
  };

  const applySavedTripPlan = (plan: SavedTripPlan) => {
    setMode("trip");
    setTripSource(plan.source);
    setTripDest(plan.destination);
    setTripPlanName(plan.name);
    setTripRoutePath(plan.routePath);
    setTripStops(plan.stops);
    setTripStats(
      plan.distanceKm != null && plan.durationMinutes != null
        ? { distance: plan.distanceKm, duration: plan.durationMinutes }
        : null
    );
    setActiveTripPlanId(plan.id);
    setFocusedPlace(null);
    setSimulationActive(false);
    setSimulationIndex(0);
    setMobileView("map");
  };

  const loadSavedTripPlans = async () => {
    if (!user) {
      setSavedTripPlans([]);
      return;
    }

    const response = await fetch("/api/trip-plans", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setSavedTripPlans(data.plans ?? []);
  };

  useEffect(() => {
    loadSavedTripPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const planId = searchParams.get("tripPlan");
    const stopsParam = searchParams.get("stops");

    if (planId) {
      fetch(`/api/trip-plans?id=${encodeURIComponent(planId)}`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (response.ok && data.plan) applySavedTripPlan(data.plan);
        })
        .catch(() => undefined);
    } else if (stopsParam) {
      const sourceName = searchParams.get("sourceName") ?? "Start Spot";
      const destName = searchParams.get("destName") ?? "End Spot";
      const trailName = searchParams.get("trailName");
      setTripLoading(true);
      setTripError(null);

      fetch(`/api/places/resolve?ids=${encodeURIComponent(stopsParam)}`)
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.places && data.places.length > 0) {
            const stops = data.places;
            setTripStops(stops);
            setTripSource(sourceName);
            setTripDest(destName);
            setTripPlanName(trailName ?? `Spontaneous Walk: ${sourceName} to ${destName}`);
            
            // Build route coordinates using OSRM foot routing
            const coordString = stops.map((s: Place) => `${s.longitude},${s.latitude}`).join(";");
            const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${coordString}?overview=full&geometries=geojson`;
            
            fetch(osrmUrl)
              .then((res) => (res.ok ? res.json() : null))
              .then((routeData) => {
                if (routeData && routeData.routes?.[0]) {
                  const route = routeData.routes[0];
                  setTripRoutePath(
                    route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
                      latitude: lat,
                      longitude: lng,
                    }))
                  );
                  setTripStats({
                    distance: parseFloat((route.distance / 1000).toFixed(1)),
                    duration: Math.round(route.duration / 60),
                  });
                } else {
                  setTripRoutePath(stops.map((s: Place) => ({ latitude: s.latitude, longitude: s.longitude })));
                  setTripStats({
                    distance: 1.5,
                    duration: 20,
                  });
                }
                setMode("trip");
                setMobileView("map");
              })
              .catch(() => {
                setTripRoutePath(stops.map((s: Place) => ({ latitude: s.latitude, longitude: s.longitude })));
                setTripStats({
                  distance: 1.5,
                  duration: 20,
                });
                setMode("trip");
                setMobileView("map");
              });
          }
        })
        .catch(() => {
          setTripError("Failed to resolve stops for the spontaneous walk.");
        })
        .finally(() => {
          setTripLoading(false);
        });
    } else {
      // Handle event venue pin from Events page (/events → Show on Map)
      const eventLat = searchParams.get("eventLat");
      const eventLng = searchParams.get("eventLng");
      if (eventLat && eventLng) {
        const lat = parseFloat(eventLat);
        const lng = parseFloat(eventLng);
        if (!isNaN(lat) && !isNaN(lng)) {
          const eventTitle = searchParams.get("eventTitle") ?? "Event Venue";
          const eventVenue = searchParams.get("eventVenue") ?? "";
          const eventCategory = searchParams.get("eventCategory") ?? "event";
          const syntheticPlace: Place = {
            id: `event-pin-${lat}-${lng}`,
            title: eventTitle,
            description: `📍 ${eventVenue}`,
            category: "event",
            image: "",
            rating: 0,
            distance: 0,
            tags: [eventCategory],
            city: activeCity,
            locality: eventVenue,
            isOpen: true,
            isTrending: true,
            reviewCount: 0,
            latitude: lat,
            longitude: lng,
          };
          setInjectedEventPlace(syntheticPlace);
          setFocusedPlace(syntheticPlace);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveTripPlan = async () => {
    if (!user) {
      const message = "Please log in to save trip plans.";
      setAuthRequiredMessage(message);
      window.location.href = "/profile";
      return;
    }

    if (!tripRoutePath || !tripStats) {
      setTripSaveStatus("error");
      setTripSaveMessage("Plan a route before saving.");
      return;
    }

    setTripSaveStatus("saving");
    setTripSaveMessage("");

    try {
      const response = await fetch("/api/trip-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tripPlanName.trim() || `${tripSource} to ${tripDest}`,
          source: tripSource,
          destination: tripDest,
          distanceKm: tripStats.distance,
          durationMinutes: tripStats.duration,
          routePath: tripRoutePath,
          stops: tripStops.slice(0, 60),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save trip plan.");

      setTripSaveStatus("saved");
      setTripSaveMessage("Trip plan saved. Share link is ready.");
      setActiveTripPlanId(data.plan.id);
      await loadSavedTripPlans();
    } catch (error: any) {
      setTripSaveStatus("error");
      setTripSaveMessage(error.message ?? "Unable to save trip plan.");
    }
  };

  const recalculateRouteForStops = async (newStops: Place[]) => {
    if (newStops.length < 2) {
      setTripRoutePath([]);
      setTripStats(null);
      return;
    }
    
    setTripLoading(true);
    try {
      const coordString = newStops.map((s) => `${s.longitude},${s.latitude}`).join(";");
      const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${coordString}?overview=full&geometries=geojson`;
      
      const res = await fetch(osrmUrl);
      if (res.ok) {
        const routeData = await res.json();
        if (routeData && routeData.routes?.[0]) {
          const route = routeData.routes[0];
          setTripRoutePath(
            route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
              latitude: lat,
              longitude: lng,
            }))
          );
          setTripStats({
            distance: parseFloat((route.distance / 1000).toFixed(1)),
            duration: Math.round(route.duration / 60),
          });
        }
      }
    } catch (err) {
      console.error("Failed to recalculate route:", err);
    } finally {
      setTripLoading(false);
    }
  };

  const handleAddStopToTrip = (place: Place) => {
    if (tripStops.some((s) => s.id === place.id)) {
      alert("Spot is already in your itinerary!");
      return;
    }
    const newStops = [...tripStops, place];
    setTripStops(newStops);
    recalculateRouteForStops(newStops);
  };

  const handleDeleteStop = (stopId: string) => {
    const newStops = tripStops.filter((s) => s.id !== stopId);
    setTripStops(newStops);
    recalculateRouteForStops(newStops);
  };

  const handleMoveStop = (index: number, direction: "up" | "down") => {
    const newStops = [...tripStops];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStops.length) return;
    
    const temp = newStops[index];
    newStops[index] = newStops[targetIndex];
    newStops[targetIndex] = temp;
    
    setTripStops(newStops);
    recalculateRouteForStops(newStops);
  };

  const calculateTotalPathDistance = (stops: Place[]) => {
    let dist = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      dist += calculateDistance(
        stops[i].latitude,
        stops[i].longitude,
        stops[i + 1].latitude,
        stops[i + 1].longitude
      );
    }
    return dist;
  };

  const handleOptimizeRoute = () => {
    if (tripStops.length <= 2) return;

    const firstStop = tripStops[0];
    const remainingStops = tripStops.slice(1);

    const permute = (arr: Place[]): Place[][] => {
      if (arr.length === 0) return [[]];
      const result: Place[][] = [];
      for (let i = 0; i < arr.length; i++) {
        const current = arr[i];
        const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
        const subPerms = permute(remaining);
        for (const p of subPerms) {
          result.push([current, ...p]);
        }
      }
      return result;
    };

    const allPermutations = permute(remainingStops);
    let bestPermutation = remainingStops;
    let minDistance = Infinity;

    allPermutations.forEach((perm) => {
      const candidateRoute = [firstStop, ...perm];
      const dist = calculateTotalPathDistance(candidateRoute);
      if (dist < minDistance) {
        minDistance = dist;
        bestPermutation = perm;
      }
    });

    const optimized = [firstStop, ...bestPermutation];
    const oldDist = calculateTotalPathDistance(tripStops);
    const newDist = calculateTotalPathDistance(optimized);
    const saved = oldDist - newDist;

    setTripStops(optimized);
    recalculateRouteForStops(optimized);

    if (saved > 0.02) {
      setOptimizationFeedback(`Route optimized! Reordered stops to save ${saved.toFixed(2)} km of walking 🚶✨`);
    } else {
      setOptimizationFeedback("Route is already in the most optimal order!");
    }

    setTimeout(() => {
      setOptimizationFeedback(null);
    }, 4000);
  };

  const getCityIATA = (cityName: string): string => {
    const normalized = cityName.toLowerCase().trim();
    if (normalized.includes("pune")) return "PNQ";
    if (normalized.includes("mumbai") || normalized.includes("bombay")) return "BOM";
    if (normalized.includes("bangalore") || normalized.includes("bengaluru")) return "BLR";
    if (normalized.includes("delhi")) return "DEL";
    if (normalized.includes("chennai") || normalized.includes("madras")) return "MAA";
    if (normalized.includes("kolhapur")) return "KLH";
    if (normalized.includes("nashik")) return "ISK";
    if (normalized.includes("cherryhill")) return "CHH";
    return "SHR";
  };

  const [postcardMessage, setPostcardMessage] = useState<string | null>(null);

  const handleGeneratePostcard = async () => {
    if (!tripStats || tripStops.length === 0) return;
    setPostcardMessage("Generating Travel Card... 📸");

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context is not available.");

      const bgGrad = ctx.createRadialGradient(540, 675, 50, 540, 675, 800);
      bgGrad.addColorStop(0, "#0b1c24");
      bgGrad.addColorStop(1, "#050b0d");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1350);

      ctx.fillStyle = "rgba(45, 212, 191, 0.03)";
      ctx.beginPath();
      ctx.arc(1080, 0, 400, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(245, 158, 11, 0.02)";
      ctx.beginPath();
      ctx.arc(0, 1350, 450, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(45, 212, 191, 0.15)";
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 30, 1020, 1290);

      ctx.fillStyle = "#2dd4bf";
      ctx.font = "900 24px Arial";
      ctx.fillText("✈  SHEHER EXPLORER TRAIL", 70, 95);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 68px Arial";
      const heading = tripPlanName || `${tripSource} to ${tripDest}`;
      const words = heading.split(" ");
      let line = "";
      let currentY = 180;
      const maxWidth = 940;
      const lineHeight = 80;

      words.forEach((word) => {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && line) {
          ctx.fillText(line, 70, currentY);
          line = word;
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      });
      ctx.fillText(line, 70, currentY);

      const statsY = currentY + 50;
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(70, statsY, 940, 180, 16);
      ctx.fill();
      ctx.stroke();

      const metrics = [
        { label: "DISTANCE", value: `${tripStats.distance} KM`, color: "#38bdf8" },
        { label: "EST. DURATION", value: `${Math.floor(tripStats.duration / 60)}h ${tripStats.duration % 60}m`, color: "#ffffff" },
        { label: "PITSTOPS", value: `${tripStops.length} SPOTS`, color: "#f59e0b" }
      ];

      metrics.forEach((metric, index) => {
        const colX = 130 + index * 300;
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "800 20px Arial";
        ctx.fillText(metric.label, colX, statsY + 65);
        
        ctx.fillStyle = metric.color;
        ctx.font = "900 42px Arial";
        ctx.fillText(metric.value, colX, statsY + 125);
      });

      const stopsStartY = statsY + 250;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "800 22px Arial";
      ctx.fillText("PLANNED ROUTE PITSTOPS", 70, stopsStartY);

      let stopY = stopsStartY + 60;
      tripStops.slice(0, 7).forEach((stop, idx) => {
        ctx.fillStyle = "rgba(45, 212, 191, 0.1)";
        ctx.beginPath();
        ctx.arc(90, stopY - 10, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(45, 212, 191, 0.3)";
        ctx.stroke();

        ctx.fillStyle = "#2dd4bf";
        ctx.font = "900 22px Arial";
        ctx.textAlign = "center";
        ctx.fillText(String(idx + 1), 90, stopY - 2);
        ctx.textAlign = "left";

        ctx.fillStyle = "#ffffff";
        ctx.font = "900 28px Arial";
        ctx.fillText(stop.title, 140, stopY - 14);

        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "700 18px Arial";
        ctx.fillText(`${stop.locality || stop.city}  ·  ★ ${stop.rating}  ·  ${stop.priceRange || "$$"}`, 140, stopY + 12);

        stopY += 92;
      });

      if (tripStops.length > 7) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "700 20px Arial";
        ctx.fillText(`And ${tripStops.length - 7} more custom pitstops...`, 70, stopY + 10);
      }

      const stampX = 810;
      const stampY = 1090;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(stampX, stampY, 180, 180, 12);
      ctx.fill();

      ctx.fillStyle = "#050b0d";
      ctx.fillRect(stampX + 20, stampY + 20, 45, 45);
      ctx.fillRect(stampX + 115, stampY + 20, 45, 45);
      ctx.fillRect(stampX + 20, stampY + 115, 45, 45);

      ctx.fillRect(stampX + 35, stampY + 35, 15, 15);
      ctx.fillRect(stampX + 130, stampY + 35, 15, 15);
      ctx.fillRect(stampX + 35, stampY + 130, 15, 15);

      ctx.fillRect(stampX + 80, stampY + 80, 20, 20);
      ctx.fillRect(stampX + 80, stampY + 40, 10, 30);
      ctx.fillRect(stampX + 40, stampY + 80, 30, 10);
      ctx.fillRect(stampX + 115, stampY + 100, 15, 40);
      ctx.fillRect(stampX + 100, stampY + 135, 40, 15);

      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "800 18px Arial";
      ctx.fillText("SCAN TO LAUNCH", 805, 1300);

      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.font = "700 16px Arial";
      ctx.fillText("CREATED VIA SHEHER PLATFORM  ·  WWW.SHEHER.APP", 70, 1300);

      canvas.toBlob((blob) => {
        if (!blob) throw new Error("Failed to export image blob.");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-travel-card.png`;
        link.click();
        URL.revokeObjectURL(url);
        setPostcardMessage("Travel Card downloaded! 📸✨");
        setTimeout(() => setPostcardMessage(null), 3000);
      }, "image/png");
    } catch (err) {
      console.error(err);
      setPostcardMessage("Failed to export Travel Card.");
      setTimeout(() => setPostcardMessage(null), 3000);
    }
  };

  const hourlyWeatherForecast = useMemo(() => {
    const forecast = [];
    const now = new Date();
    const city = (activeCity || "Pune") as any;
    for (let i = 0; i < 6; i++) {
      const futureDate = new Date(now.getTime() + i * 60 * 60 * 1000);
      const weather = getCityWeather(city, futureDate);
      forecast.push({
        time: futureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hourValue: futureDate.getHours(),
        weather
      });
    }
    return forecast;
  }, [activeCity]);

  const selectedWeather = useMemo(() => {
    const city = (activeCity || "Pune") as any;
    const targetDate = new Date();
    targetDate.setHours(simulatedDepartureHour);
    return getCityWeather(city, targetDate);
  }, [activeCity, simulatedDepartureHour]);

  useEffect(() => {
    if (selectedWeather.condition === "Rainy") {
      const hasOutdoorStops = tripStops.some(stop => 
        stop.tags.includes("outdoor") || 
        stop.tags.includes("viewpoint") || 
        stop.tags.includes("scenic") || 
        stop.category === "event"
      );
      if (hasOutdoorStops) {
        setWeatherAlternativeAlert(`⚠️ Rain expected during your simulated departure at ${simulatedDepartureHour % 12 || 12} ${simulatedDepartureHour >= 12 ? 'PM' : 'AM'}. Swap outdoor stops with cozy cafes to stay dry!`);
      } else {
        setWeatherAlternativeAlert(null);
      }
    } else {
      setWeatherAlternativeAlert(null);
    }
  }, [selectedWeather, tripStops, simulatedDepartureHour]);

  // Real-time Flash Deal Socket listener
  useEffect(() => {
    const socket = io(API_URL, {
      withCredentials: true,
    });

    socket.on("new-flash-deal", (deal: any) => {
      setActiveFlashDeal(deal);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSwapToIndoorSpots = () => {
    let swappedCount = 0;
    const updatedStops = tripStops.map(stop => {
      const isOutdoor = stop.tags.includes("outdoor") || 
        stop.tags.includes("viewpoint") || 
        stop.tags.includes("scenic") || 
        stop.category === "event";

      if (isOutdoor) {
        let nearestIndoor: Place | null = null;
        let minD = Infinity;

        allPlaces.forEach(candidate => {
          if (tripStops.some(s => s.id === candidate.id)) return;

          const isCozyOrCafe = candidate.category === "cafe" || 
            candidate.tags.includes("cozy") || 
            candidate.tags.includes("indoor") || 
            candidate.tags.includes("comfort-food");
             
          if (isCozyOrCafe) {
            const dist = calculateDistance(stop.latitude, stop.longitude, candidate.latitude, candidate.longitude);
            if (dist < minD) {
              minD = dist;
              nearestIndoor = candidate;
            }
          }
        });

        if (nearestIndoor) {
          swappedCount++;
          return nearestIndoor;
        }
      }
      return stop;
    });

    if (swappedCount > 0) {
      setTripStops(updatedStops);
      recalculateRouteForStops(updatedStops);
      setWeatherAlternativeAlert(null);
      alert(`Swapped ${swappedCount} outdoor stops with nearby cozy cafes! ☕`);
    } else {
      alert("No suitable indoor alternatives found nearby.");
    }
  };

  const generateWhatsAppShareText = () => {
    if (!tripStats) return "";
    const isFree = (p: Place) => p.priceRange === "Free" || p.tags.includes("free");
    
    let text = `*🗺️ Sheher Itinerary: ${tripPlanName || `${tripSource} to ${tripDest}`}*\n`;
    text += `🚶 *Total Walk*: ${tripStats.distance} km | ⏱️ *Duration*: ${Math.floor(tripStats.duration / 60)}h ${tripStats.duration % 60}m\n`;
    if (estimatedToll > 0) {
      text += `🚗 *Est. Tolls*: ₹${estimatedToll} (SUV: ₹${Math.round(estimatedToll * 1.5)})\n`;
    }
    text += `\n*Planned Pitstops:*`;
    
    tripStops.forEach((stop, idx) => {
      text += `\n${idx + 1}️⃣ *${stop.title}* - ${stop.rating} ★ (${getCategoryLabel(stop.category, stop.tags)})`;
      text += `\n   📍 _${stop.locality || stop.city}_${isFree(stop) ? " [Free Entry]" : ""}`;
    });
    
    const shareUrl = activeTripPlanId 
      ? `${window.location.origin}/trip/${activeTripPlanId}` 
      : `${window.location.origin}/map?mode=trip&stops=${encodeURIComponent(tripStops.map(s => s.id).join(","))}&sourceName=${encodeURIComponent(tripSource)}&destName=${encodeURIComponent(tripDest)}&trailName=${encodeURIComponent(tripPlanName)}`;
    
    text += `\n\nExplore interactive map route here:\n${shareUrl}`;
    text += `\n\n_Planned via Sheher City Explorer ✨_`;
    return text;
  };

  const shareTripPlan = async () => {
    if (!tripRoutePath || !tripStats) return;
    setIsShareModalOpen(true);
  };

  const simStepSize = useMemo(() => {
    if (!tripRoutePath) return 1;
    return Math.max(1, Math.floor(tripRoutePath.length / 150));
  }, [tripRoutePath]);

  useEffect(() => {
    if (!simulationActive || !tripRoutePath) return;
    if (simulationIndex >= tripRoutePath.length - 1) {
      setSimulationActive(false);
      return;
    }

    const intervalTime = Math.max(40, Math.floor(500 / simulationSpeed));
    const timer = setTimeout(() => {
      setSimulationIndex(prev => {
        const next = prev + simStepSize;
        return next >= tripRoutePath.length ? tripRoutePath.length - 1 : next;
      });
    }, intervalTime);

    return () => clearTimeout(timer);
  }, [simulationActive, simulationIndex, simulationSpeed, tripRoutePath, simStepSize]);

  const currentSimCoord = useMemo(() => {
    if (!tripRoutePath || !simulationActive) return null;
    return tripRoutePath[simulationIndex] || null;
  }, [tripRoutePath, simulationIndex, simulationActive]);

  useEffect(() => {
    if (!currentSimCoord || !tripStops.length) {
      setUpcomingStopAlert(null);
      return;
    }

    let nearest: Place | null = null;
    let minD = 3.0;

    tripStops.forEach(stop => {
      const dist = calculateDistance(
        currentSimCoord.latitude,
        currentSimCoord.longitude,
        stop.latitude,
        stop.longitude
      );
      if (dist < minD) {
        minD = dist;
        nearest = stop;
      }
    });

    if (nearest) {
      setUpcomingStopAlert({
        place: nearest,
        distance: minD
      });
    } else {
      setUpcomingStopAlert(null);
    }
  }, [currentSimCoord, tripStops]);

  const filteredTripStops = useMemo(() => {
    return tripStops.filter(stop => {
      if (selectedTripCategory === "all") return true;
      if (selectedTripCategory === "food") {
        return stop.tags.includes("food-stall") || stop.tags.includes("local-food") || stop.tags.includes("food-plaza") || stop.category === "restaurant" || stop.category === "cafe";
      }
      if (selectedTripCategory === "ev") {
        return stop.tags.includes("ev-station");
      }
      if (selectedTripCategory === "toilet") {
        return stop.tags.includes("toilet") || stop.tags.includes("restroom");
      }
      if (selectedTripCategory === "scenic") {
        return stop.tags.includes("viewpoint") || stop.tags.includes("scenic");
      }
      return true;
    });
  }, [tripStops, selectedTripCategory]);

  const usingLivePlaces = livePlaces.length > 0;
  const [curatedPlaces, setCuratedPlaces] = useState<Place[]>([]);
  useEffect(() => {
    let cancelled = false;
    setCuratedPlaces([]); // Clear stale curated places on city change
    getFallbackPlacesForCity(activeCity).then((places) => {
      if (!cancelled) setCuratedPlaces(places);
    });
    return () => {
      cancelled = true;
    };
  }, [activeCity]);

  const allPlaces = useMemo(() => {
    const combined = combineLiveAndCuratedPlaces(livePlaces, curatedPlaces);

    // Add saved places (mock and live) that belong to this city to ensure they show up on the map
    const combinedIds = new Set(combined.map((p) => p.id));
    const extraSaved: Place[] = [];

    savedPlaces.forEach((place) => {
      if (
        place.city.toLowerCase() === activeCity.toLowerCase() &&
        !combinedIds.has(place.id)
      ) {
        extraSaved.push(place);
      }
    });

    const all = [...combined, ...extraSaved];
    // Include pinned event marker if navigated from Events page
    if (injectedEventPlace && !combinedIds.has(injectedEventPlace.id)) {
      all.push(injectedEventPlace);
    }
    return getPlacesWithDistance(all, activeLocation);
  }, [activeLocation, curatedPlaces, livePlaces, savedPlaces, activeCity, injectedEventPlace]);

  const filteredPlaces = useMemo(() => {
    return allPlaces.filter((place) => {
      if (selectedCategory === "saved") {
        if (!savedPlaceIds.has(place.id)) return false;
      } else if (selectedCategory === "night-drive") {
        if (!place.tags.includes("night-drive")) return false;
      } else if (selectedCategory !== "all" && place.category !== selectedCategory) {
        return false;
      }
      if (showOnlyOpen && !isOpenNow(place.hours)) return false;
      if (minRating > 0 && place.rating < minRating) return false;
      if (vegOnly && !isVegetarianPlace(place)) return false;
      return true;
    });
  }, [allPlaces, selectedCategory, showOnlyOpen, minRating, vegOnly, savedPlaceIds]);

  const sortedPlaces = useMemo(() => [...filteredPlaces].sort((a, b) => a.distance - b.distance), [filteredPlaces]);
  const locationLabel =
    locationSource === "browser" && activeCity === detectedCity
      ? `Near you in ${activeCity}`
      : usingLivePlaces
        ? `Live + curated ${activeCity} places`
        : `Curated ${activeCity} places`;

  const categories = useMemo(() => {
    const citySavedCount = allPlaces.filter((p) => savedPlaceIds.has(p.id)).length;
    return [
      { value: "all", label: "All Spots" },
      ...(citySavedCount > 0 ? [{ value: "saved", label: "❤ Favorites" }] : []),
      { value: "night-drive", label: "Night Drives" },
      { value: "ice-cream", label: "🍦 Ice Cream" },
      { value: "cafe", label: "Cafes" },
      { value: "restaurant", label: "Restaurants" },
      { value: "event", label: "Events" },
      { value: "nightlife", label: "Nightlife" },
      { value: "food-stall", label: "Food Stalls" },
      { value: "bar", label: "Bars" },
      { value: "dessert", label: "Desserts" },
      { value: "street-food", label: "Street Food" },
    ];
  }, [allPlaces, savedPlaceIds]);

  const estimatedToll = useMemo(() => {
    if (!tripStats) return 0;
    
    const sourceNorm = tripSource.toLowerCase().trim();
    const destNorm = tripDest.toLowerCase().trim();
    const isPuneMumbai = 
      (sourceNorm.includes("pune") && destNorm.includes("mumbai")) || 
      (sourceNorm.includes("mumbai") && destNorm.includes("pune"));
    
    let baseToll = 0;
    if (isPuneMumbai) {
      baseToll = 320; // Pune-Mumbai Expressway rate
    } else {
      baseToll = Math.round(tripStats.distance * 2.2);
    }
    
    if (vehicleType === "suv") return Math.round(baseToll * 1.5);
    if (vehicleType === "lcv") return Math.round(baseToll * 2.5);
    return baseToll;
  }, [tripStats, tripSource, tripDest, vehicleType]);

  return (
    <>
    <div className="w-full max-w-full flex flex-col overflow-hidden map-page-container">

      {/* Filter toolbar — Floating Glassmorphic Capsule */}
      <div className="flex-shrink-0 z-[1010] px-2 pt-2 pb-0.5 md:px-4 md:pt-4">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 rounded-xl md:rounded-2xl glass-toolbar px-3 py-2.5 md:px-4 md:py-3 border border-[var(--border)] shadow-xl w-full">
          <div className="shrink-0 w-full md:w-[200px]">
            <CitySwitcher
              value={activeCity}
              onChange={(city) => {
                chooseCity(city);
                setFocusedPlace(null);
                setDetailsPlace(null);
              }}
              className="mb-0 w-full"
            />
          </div>

          <div className="hidden md:block h-6 w-px bg-[var(--border)] shrink-0" />

          {/* Horizontal Filter Chips */}
          <div className="flex-1 no-scrollbar flex items-center gap-2 overflow-x-auto scroll-fade-right py-1">
            {categories.map((cat) => {
              const active = selectedCategory === cat.value;
              
              // Lucide Icon mapping
              let icon: React.ReactNode = null;
              if (cat.value === "all") icon = <Compass size={13} className="shrink-0" />;
              else if (cat.value === "saved") icon = <Heart size={13} className="shrink-0 fill-rose-500 text-rose-500" />;
              else if (cat.value === "night-drive") icon = <Car size={13} className="shrink-0 text-pink-400" />;
              else if (cat.value === "ice-cream") icon = <IceCream size={13} className="shrink-0 text-purple-400 animate-pulse" />;
              else if (cat.value === "cafe") icon = <Coffee size={13} className="shrink-0 text-amber-400" />;
              else if (cat.value === "restaurant") icon = <Utensils size={13} className="shrink-0 text-rose-400" />;
              else if (cat.value === "event") icon = <Sparkles size={13} className="shrink-0 text-sky-400" />;
              else if (cat.value === "nightlife") icon = <Moon size={13} className="shrink-0 text-fuchsia-400" />;
              else if (cat.value === "food-stall") icon = <Store size={13} className="shrink-0 text-yellow-400" />;
              else if (cat.value === "bar") icon = <GlassWater size={13} className="shrink-0 text-rose-300" />;
              else if (cat.value === "dessert") icon = <Cake size={13} className="shrink-0 text-teal-400" />;
              else if (cat.value === "street-food") icon = <Soup size={13} className="shrink-0 text-orange-400" />;

              // Strip raw emojis from labels since we render Lucide icons
              const cleanLabel = cat.label.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim();

              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.value);
                    setFocusedPlace(null);
                  }}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition-all border flex items-center gap-1.5 cursor-pointer select-none",
                    active
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)] shadow-md shadow-teal-500/10 scale-[1.02]"
                      : "bg-[var(--input)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
                  )}
                >
                  {icon}
                  <span>{cleanLabel}</span>
                </button>
              );
            })}
          </div>

          <div className="h-px md:h-6 w-full md:w-px bg-[var(--border)] shrink-0" />

          {/* Veg / Open / Rating */}
          <div className="no-scrollbar flex items-center justify-between md:justify-start gap-2 shrink-0 py-0.5">
            <button
              type="button"
              onClick={() => { setVegOnly(!vegOnly); setFocusedPlace(null); }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black border transition-all cursor-pointer select-none",
                vegOnly ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-sm" : "bg-[var(--input)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--panel-soft)]"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", vegOnly ? "bg-emerald-400 shadow-md shadow-emerald-400/50" : "bg-slate-500")} />
              Veg
            </button>
            <button
              type="button"
              onClick={() => { setShowOnlyOpen(!showOnlyOpen); setFocusedPlace(null); }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black border transition-all cursor-pointer select-none",
                showOnlyOpen ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-sm" : "bg-[var(--input)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--panel-soft)]"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", showOnlyOpen ? "bg-emerald-300 animate-pulse shadow-md shadow-emerald-300/50" : "bg-slate-500")} />
              Open
            </button>
            <button
              type="button"
              onClick={() => { setMinRating(minRating === 0 ? 4.5 : 0); setFocusedPlace(null); }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black border transition-all cursor-pointer select-none",
                minRating > 0 ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/30 shadow-sm" : "bg-[var(--input)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--panel-soft)]"
              )}
            >
              <Star size={12} className={cn("shrink-0", minRating > 0 ? "fill-yellow-300 text-yellow-300" : "text-slate-500")} />
              4.5★+
            </button>
          </div>
        </div>
      </div>


      {/* Main content: map 60% + sidebar 40% */}
      <div ref={splitContainerRef} className="flex flex-1 min-h-0 overflow-hidden gap-2 p-2 flex-col md:flex-row">

        {/* MAP — always visible on desktop, toggled on mobile */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
          style={{ "--map-width": `${mapWidth}%` } as React.CSSProperties}
          className={cn(
            "resizable-map relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] min-h-0",
            mobileView === "list"
              ? "hidden md:block md:h-full"
              : "w-full h-full md:h-full"
          )}
        >
          {/* Location permission — floats inside map, doesn't affect layout */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[600] w-[90%] max-w-md pointer-events-auto">
            <LocationPermissionCard
              source={locationSource}
              loading={locationLoading}
              error={locationError}
              liveTracking={liveTracking}
              onToggleTracking={toggleLiveTracking}
              onRequest={() => {
                preferDetectedCity();
                requestLocation();
              }}
            />
          </div>

          <div className="absolute top-4 left-4 z-[500] flex flex-wrap items-center gap-2 max-w-[calc(100%-2rem)]">
            <button
              type="button"
              onClick={() => setIsSuggestModalOpen(true)}
              className="flex items-center gap-2 rounded-full border border-teal-500/30 bg-slate-950/90 px-4 py-2.5 text-xs font-black tracking-wider uppercase text-teal-400 shadow-xl backdrop-blur-md transition-all hover:bg-slate-900 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span className="flex h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
              + Add Spot
            </button>

            {locationSource === "browser" && (
              <button
                type="button"
                onClick={toggleLiveTracking}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-black tracking-wider uppercase shadow-xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer",
                  liveTracking
                    ? "border-teal-500/40 bg-teal-950/95 text-teal-400"
                    : "border-slate-800 bg-slate-950/90 text-slate-400 hover:text-slate-200"
                )}
              >
                <LocateFixed 
                  size={14} 
                  className={cn(
                    liveTracking ? "text-teal-400 animate-pulse" : "text-slate-400"
                  )} 
                />
                <span>{liveTracking ? "Live: ON" : "Live: OFF"}</span>
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-300",
                  liveTracking ? "bg-teal-400 animate-ping" : "bg-slate-600"
                )} />
              </button>
            )}

            {focusedPlace && (
              <button
                type="button"
                onClick={() => setHideOtherPlaces(!hideOtherPlaces)}
                className="flex items-center gap-2 rounded-full border border-teal-500/30 bg-slate-950/90 px-4 py-2.5 text-xs font-black tracking-wider uppercase text-teal-400 shadow-xl backdrop-blur-md transition-all hover:bg-slate-900 hover:scale-105 active:scale-95 cursor-pointer animate-fade-in"
              >
                {hideOtherPlaces ? <Eye size={14} /> : <EyeOff size={14} />}
                {hideOtherPlaces ? "Show All Spots" : "Hide Other Spots"}
              </button>
            )}
          </div>

          <MapView
            places={mode === "trip" ? tripStops : (hideOtherPlaces && focusedPlace ? [focusedPlace] : sortedPlaces)}
            userLocation={activeLocation}
            selectedPlace={focusedPlace}
            onMarkerClick={setFocusedPlace}
            onCenterChange={setMapCenter}
            onBoundsChange={setMapBounds}
            className="h-full w-full rounded-xl border-0"
            tripMode={mode === "trip"}
            tripRoutePath={mode === "trip" ? tripRoutePath : null}
            simulationActive={simulationActive}
            simulationCoord={currentSimCoord}
            scrollWheelZoom={true}
          />

          {livePlacesLoading && mode !== "trip" && (
            <div className="absolute top-4 right-4 z-[500] flex items-center gap-2 rounded-full border border-teal-500/30 bg-slate-950/90 px-3.5 py-2 text-xs font-black tracking-wider uppercase text-teal-400 shadow-xl backdrop-blur-md animate-pulse">
              <span className="flex h-2 w-2 rounded-full bg-teal-400 animate-ping" />
              <span>Scanning area...</span>
            </div>
          )}

          {/* Simulation Cruise Upcoming Stop Toast Alert */}
          {mode === "trip" && upcomingStopAlert && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-16 left-4 right-4 z-[500] flex items-center gap-3.5 rounded-xl border border-cyan-400/40 bg-slate-950/92 px-4 py-3 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-4 sm:max-w-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
                <Navigation size={18} className="animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                  Upcoming in {upcomingStopAlert.distance.toFixed(1)} km
                </p>
                <h4 className="mt-0.5 line-clamp-1 text-xs font-black text-white">
                  {upcomingStopAlert.place.title}
                </h4>
                <p className="line-clamp-1 text-[10px] text-slate-300/80">
                  {upcomingStopAlert.place.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFocusedPlace(upcomingStopAlert.place);
                  setDetailsPlace(upcomingStopAlert.place);
                }}
                className="shrink-0 rounded-lg bg-cyan-400 px-3 py-1.5 text-[10px] font-black text-slate-950 hover:bg-cyan-300 active:scale-95 transition cursor-pointer"
              >
                Inspect
              </button>
            </motion.div>
          )}

          {focusedPlace && (
            <div className="absolute inset-x-2 bottom-2 z-[500] rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-2xl backdrop-blur-xl sm:inset-x-3 sm:bottom-3 sm:p-4 md:hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-200">
                    {getCategoryLabel(focusedPlace.category, focusedPlace.tags)}
                  </p>
                  <h2 className="mt-1 line-clamp-1 text-base font-black text-[var(--foreground)] sm:text-lg">{focusedPlace.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--muted-strong)]">{formatPlaceArea(focusedPlace)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFocusedPlace(null)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-black text-[var(--muted-strong)] cursor-pointer"
                >
                  Close
                </button>
              </div>
              <button type="button" onClick={() => setDetailsPlace(focusedPlace)} className="mt-3 w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-black text-[var(--primary-foreground)]">
                View Details
              </button>
            </div>
          )}

          {mobileView === "map" && !focusedPlace && (
            <div className="absolute inset-x-2 bottom-2 z-[500] rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-2xl backdrop-blur-xl md:hidden">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMobileCardCollapsed(!isMobileCardCollapsed)}
                    className="p-1.5 rounded-lg bg-[var(--panel-soft)] border border-[var(--border)] text-[var(--muted-strong)] hover:text-[var(--foreground)] transition cursor-pointer"
                    title={isMobileCardCollapsed ? "Expand list" : "Collapse list"}
                  >
                    <ChevronRight size={16} className={cn("transition-transform duration-200", isMobileCardCollapsed ? "rotate-90" : "-rotate-90")} />
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-300">
                      {mode === "trip" ? "Route stops" : "Nearby places"}
                    </p>
                    <p className="truncate text-sm font-semibold text-[var(--muted)]">
                      {mode === "trip"
                        ? `${filteredTripStops.length} stops`
                        : `${sortedPlaces.length} places`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-black text-[var(--primary-foreground)]"
                >
                  Full list
                </button>
              </div>

              {!isMobileCardCollapsed && (
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 mt-2">
                  {(mode === "trip" ? filteredTripStops : sortedPlaces).slice(0, 8).map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => {
                        setFocusedPlace(place);
                        setMapCenter({ latitude: place.latitude, longitude: place.longitude });
                      }}
                      className="w-52 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-left"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)]">
                        {getCategoryLabel(place.category, place.tags)}
                      </p>
                      <h3 className="mt-1 line-clamp-1 text-sm font-black text-[var(--foreground)]">{place.title}</h3>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs font-bold text-[var(--muted-strong)]">
                        <span className="line-clamp-1">{formatPlaceArea(place)}</span>
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Star size={12} className="fill-amber-300" />
                          {place.rating}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Mobile Map/List toggle FAB */}
        <div className="fixed left-4 z-[600] md:hidden" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}>
          <button
            type="button"
            onClick={() => setMobileView(mobileView === "map" ? "list" : "map")}
            className="flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-black text-[var(--primary-foreground)] shadow-2xl shadow-black/30 transition active:scale-95"
          >
            {mobileView === "map" ? (
              <><MapPin size={16} /> List</>
            ) : (
              <><Map size={16} /> Map</>
            )}
          </button>
        </div>

        {/* Resize Divider Handle */}
        <div
          onMouseDown={startResizing}
          onTouchStart={startResizing}
          className={cn(
            "hidden md:flex items-center justify-center w-3 z-[600] cursor-col-resize shrink-0 select-none group relative h-full -mx-1.5",
            isDragging ? "bg-teal-500/10" : "bg-transparent hover:bg-teal-500/5"
          )}
        >
          {/* Visual line inside the handle */}
          <div className={cn(
            "w-[1px] h-full transition-all duration-150",
            isDragging ? "bg-teal-400" : "bg-[var(--border)] group-hover:bg-teal-400"
          )} />
          
          {/* Grab handle dot button */}
          <div className={cn(
            "absolute w-5 h-8 rounded-md border flex flex-col items-center justify-center gap-0.5 shadow-md transition-all duration-200 pointer-events-none",
            isDragging
              ? "bg-teal-400 border-teal-300 text-slate-950 scale-105"
              : "bg-[var(--panel-strong)] border-[var(--border)] text-[var(--muted-strong)] group-hover:border-teal-400/50 group-hover:text-teal-400"
          )}>
            <GripVertical size={11} />
          </div>
        </div>

        <aside
          style={{ "--sidebar-width": `${100 - mapWidth}%` } as React.CSSProperties}
          className={cn(
            "resizable-sidebar relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-3 h-full flex flex-col gap-3 min-h-0",
            mobileView === "map"
              ? "hidden md:flex md:shrink-0"
              : "w-full h-full md:shrink-0"
          )}
        >
          <div className="custom-scrollbar overflow-y-auto flex-1 space-y-3 pr-0.5 min-h-0">
          {/* LIVE FLASH DEAL ALERTS */}
          {activeFlashDeal && user?.isPremiumPass && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/20 via-yellow-400/10 to-amber-600/5 p-4 space-y-3 shadow-lg"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                  <Sparkles size={14} className="animate-pulse" />
                  <span>🔥 LIVE 50% OFF FLASH DEAL!</span>
                </div>
                <button type="button" onClick={() => setActiveFlashDeal(null)} className="text-[var(--muted)] hover:text-white cursor-pointer">
                  <X size={14} />
                </button>
              </div>
              <div>
                <h4 className="font-black text-sm text-[var(--foreground)]">{activeFlashDeal.placeTitle}</h4>
                <p className="text-xs text-[var(--muted)] mt-1 font-semibold leading-relaxed">
                  {activeFlashDeal.description || "Grab 50% off on all specialty items for the next 45 minutes."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const place = allPlaces.find(p => p.id === activeFlashDeal.placeId);
                  if (place) {
                    handleAddStopToTrip(place);
                    setFocusedPlace(place);
                    setMapCenter({ latitude: place.latitude, longitude: place.longitude });
                    setActiveFlashDeal(null);
                  } else {
                    alert("Adding discount stop...");
                  }
                }}
                className="w-full rounded bg-amber-400 hover:bg-amber-300 py-2 text-center text-xs font-black text-slate-950 transition duration-150 cursor-pointer shadow"
              >
                Route to Deal & Claim Coupon 🚗
              </button>
            </motion.div>
          )}

          {activeFlashDeal && !user?.isPremiumPass && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-slate-700 bg-slate-900/90 p-4 space-y-3 shadow-lg"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-400">
                  <ShieldAlert size={14} className="text-amber-400 animate-bounce" />
                  <span>👀 EXCLUSIVE FLASH DEAL ACTIVE</span>
                </div>
                <button type="button" onClick={() => setActiveFlashDeal(null)} className="text-[var(--muted)] hover:text-white cursor-pointer">
                  <X size={14} />
                </button>
              </div>
              <div>
                <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                  A huge **50% discount** deal has been posted nearby! Upgrade to the **Sheher Pass** to see the venue and instantly route to it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  router.push("/profile");
                }}
                className="w-full rounded bg-gradient-to-r from-amber-400 to-amber-500 py-2 text-center text-xs font-black text-slate-950 hover:from-amber-300 hover:to-amber-400 transition duration-150 cursor-pointer"
              >
                Upgrade to Sheher Pass (₹199) ⚡
              </button>
            </motion.div>
          )}

          {/* Selected Place Preview Card */}
          {focusedPlace && (() => {
            // Crowd indicator calculation
            let crowdIndicator = "⭐ Recommended Spot";
            if (["cafe", "restaurant", "street-food", "food-stall"].includes(focusedPlace.category)) {
              crowdIndicator = focusedPlace.rating >= 4.6 ? "🔥 Bustling Hub (Popular)" : "☕ Lively Spot (Moderate crowd)";
            } else if (focusedPlace.tags.includes("scenic") || focusedPlace.tags.includes("viewpoint") || focusedPlace.tags.includes("scenic-cruise")) {
              crowdIndicator = "🍃 Serene Stroll (Calm vibe)";
            } else if (focusedPlace.category === "event") {
              crowdIndicator = "✨ Vibrant gathering";
            }

            // Operating hours countdown
            let hoursStatus = "Timings vary";
            if (focusedPlace.hours) {
              const isOpen = isOpenNow(focusedPlace.hours);
              hoursStatus = isOpen
                ? `Closes at ${focusedPlace.hours.close}`
                : `Opens at ${focusedPlace.hours.open}`;
            }

            // Facilities list
            const facilities = [];
            if (focusedPlace.tags.includes("ev-station") || focusedPlace.tags.includes("ev-charger")) {
              facilities.push({ text: "EV Charging", icon: <span className="text-emerald-400">⚡</span> });
            }
            if (focusedPlace.tags.includes("toilet") || focusedPlace.tags.includes("restroom") || focusedPlace.tags.includes("washroom")) {
              facilities.push({ text: "Restroom", icon: <span className="text-orange-400">🚻</span> });
            }
            if (focusedPlace.category === "cafe") {
              facilities.push({ text: "Free Wi-Fi", icon: <span className="text-blue-400">📶</span> });
            }
            if (["cafe", "restaurant", "bar"].includes(focusedPlace.category)) {
              facilities.push({ text: "Seating Available", icon: <span className="text-amber-400">🪑</span> });
            }
            if (focusedPlace.rating >= 4.6) {
              facilities.push({ text: "Top Choice", icon: <span className="text-yellow-400">🏆</span> });
            }

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="rounded-xl border border-teal-500/20 bg-slate-950/85 p-4 space-y-3.5 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-teal-300 bg-teal-500/10 px-2.5 py-0.5 rounded border border-teal-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                    Selected Spot
                  </span>
                  <button
                    type="button"
                    onClick={() => setFocusedPlace(null)}
                    className="text-xs font-black text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </div>

                <div className="relative h-40 w-full overflow-hidden rounded-xl bg-slate-900 border border-slate-800/80 shadow-md">
                  <LazyImage
                    src={focusedPlace.image}
                    alt={focusedPlace.title}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                  <span className="absolute bottom-3 left-3 rounded-full bg-slate-900/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-teal-300 border border-white/5 shadow-md">
                    {getCategoryLabel(focusedPlace.category, focusedPlace.tags)}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <h3 className="text-lg font-black text-white tracking-tight leading-tight">{focusedPlace.title}</h3>
                  <p className="text-xs font-bold text-slate-400">{formatPlaceArea(focusedPlace)}</p>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                  {focusedPlace.description}
                </p>

                {/* Vibe & Hours Status Bar */}
                <div className="flex flex-row items-center justify-between gap-2 border-y border-white/5 py-2 text-[10px] font-bold text-slate-400">
                  <span className="flex items-center gap-1">
                    <span>{crowdIndicator}</span>
                  </span>
                  <span className="h-3 w-px bg-white/5" />
                  <span className="flex items-center gap-1 text-emerald-400 font-black">
                    <Clock size={11} className="shrink-0" />
                    {hoursStatus}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px] font-black tracking-wider uppercase text-slate-200">
                  <div className="flex flex-col items-center justify-center rounded-lg bg-slate-900/60 border border-slate-800/80 p-2 text-center">
                    <MapPin size={13} className="text-cyan-300 mb-1" />
                    <span className="text-[8px] normal-case text-slate-400 leading-tight">Distance</span>
                    <span className="mt-0.5 text-white">{formatDistance(focusedPlace.distance)}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-lg bg-slate-900/60 border border-slate-800/80 p-2 text-center">
                    <Star size={13} className="fill-yellow-400 text-yellow-400 mb-1" />
                    <span className="text-[8px] normal-case text-slate-400 leading-tight">Rating</span>
                    <span className="mt-0.5 text-white">{focusedPlace.rating} ★</span>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-lg bg-slate-900/60 border border-slate-800/80 p-2 text-center">
                    <Star size={13} className="text-teal-400 fill-teal-400/20 mb-1" />
                    <span className="text-[8px] normal-case text-slate-400 leading-tight">Price Range</span>
                    <span className="mt-0.5 text-white">{focusedPlace.priceRange ?? "Varies"}</span>
                  </div>
                </div>

                {/* Facilities/Amenities */}
                {facilities.length > 0 && (
                  <div className="space-y-1.5 pt-0.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Amenities & Perks</label>
                    <div className="flex flex-wrap gap-1.5">
                      {facilities.map((fac, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 rounded bg-slate-900/80 border border-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-300">
                          {fac.icon}
                          <span>{fac.text}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setDetailsPlace(focusedPlace)}
                  className="w-full rounded-xl bg-teal-500 hover:bg-teal-400 py-3 text-xs font-black uppercase tracking-wider text-slate-950 hover:scale-[1.01] active:scale-98 transition duration-200 cursor-pointer shadow-lg shadow-teal-500/10"
                >
                  View Detailed Conveniences 🔍
                </button>
              </motion.div>
            );
          })()}

          {/* Mode Switcher Tabs */}
          <div className="flex p-1 rounded-full bg-[var(--panel-soft)] border border-[var(--border)] w-full">
            <button
              type="button"
              onClick={() => setMode("explore")}
              className={cn(
                "flex-1 text-center py-2 text-xs font-black uppercase tracking-wider rounded-full transition-all cursor-pointer",
                mode === "explore"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              📍 Explore Spots
            </button>
            <button
              type="button"
              onClick={() => setMode("trip")}
              className={cn(
                "flex-1 text-center py-2 text-xs font-black uppercase tracking-wider rounded-full transition-all cursor-pointer",
                mode === "trip"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              🚗 Plan a Trip
            </button>
          </div>

          {mode === "explore" ? (
            <>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-black text-[var(--foreground)]">Nearby Places</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">Sorted by distance from the active location.</p>
                    {livePlacesError && (
                      <p className="mt-2 text-xs font-semibold text-rose-200">
                        {livePlacesError}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    title={locationSource === "browser" ? "Using your location" : "Use my location"}
                    onClick={() => {
                      preferDetectedCity();
                      requestLocation();
                    }}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-lg transition-all",
                      locationSource === "browser"
                        ? "bg-teal-300 text-slate-950 shadow-lg shadow-teal-400/30"
                        : "bg-[var(--panel)] text-[var(--muted-strong)] border border-[var(--border)] hover:bg-teal-300/20 hover:text-teal-300 hover:border-teal-400/40",
                      locationLoading && "animate-pulse"
                    )}
                  >
                    <LocateFixed size={19} className={locationLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 pr-0">
                {sortedPlaces.slice(0, visiblePlacesCount).map((place) => {
                  const active = focusedPlace?.id === place.id;
                  const open = isOpenNow(place.hours);
                  const hasHours = Boolean(place.hours);

                  // Capability tag selection
                  let capabilityTag: { text: string; className: string } | null = null;
                  if (place.tags.includes("ev-station") || place.tags.includes("ev-charger")) {
                    capabilityTag = { text: "⚡ EV Support", className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" };
                  } else if (place.tags.includes("toilet") || place.tags.includes("restroom") || place.tags.includes("washroom")) {
                    capabilityTag = { text: "🚻 Restroom", className: "bg-orange-500/10 text-orange-300 border-orange-500/20" };
                  } else if (place.tags.includes("viewpoint") || place.tags.includes("scenic") || place.tags.includes("scenic-cruise")) {
                    capabilityTag = { text: "⛰️ Scenic", className: "bg-purple-500/10 text-purple-300 border-purple-500/20" };
                  } else if (place.tags.includes("night-drive") || place.category === "nightlife") {
                    capabilityTag = { text: "🌙 Late Night", className: "bg-pink-500/10 text-pink-300 border-pink-500/20" };
                  } else if (["cafe", "restaurant", "street-food", "food-stall"].includes(place.category)) {
                    capabilityTag = { text: "🍽️ Dining", className: "bg-teal-500/10 text-teal-300 border-teal-500/20" };
                  }

                  return (
                    <div
                      key={place.id}
                      className={cn(
                        "w-full rounded-xl border p-3.5 text-left place-card-modern",
                        active
                          ? "border-teal-400 bg-teal-500/5 shadow-lg shadow-teal-500/10 scale-[1.01]"
                          : "border-[var(--border)] bg-[var(--panel-soft)] hover:bg-[var(--panel)]"
                      )}
                    >
                      <button type="button" onClick={() => setFocusedPlace(place)} className="w-full text-left flex items-center gap-3.5">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-900 border border-slate-800 shadow-inner group">
                          <LazyImage
                            src={place.image}
                            alt={place.title}
                          />
                        </div>
 
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-1.5 text-[10px] font-black uppercase tracking-wider">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[var(--muted)]">{getCategoryLabel(place.category, place.tags)}</span>
                              <span className="h-1 w-1 rounded-full bg-[var(--muted)]" />
                              <span className={cn("font-black", hasHours ? (open ? "text-emerald-400" : "text-rose-400") : "text-slate-400")}>
                                {hasHours ? (open ? "Open" : "Closed") : "Unknown"}
                              </span>
                            </div>
                            {capabilityTag && (
                              <span className={cn("rounded px-1.5 py-0.2 text-[8px] font-black tracking-wide border shrink-0", capabilityTag.className)}>
                                {capabilityTag.text}
                              </span>
                            )}
                          </div>
                          
                          <h3 className="font-black text-[var(--foreground)] text-sm line-clamp-1 tracking-tight leading-tight">{place.title}</h3>
                          <p className="text-xs font-semibold text-[var(--muted-strong)] line-clamp-1">{formatPlaceArea(place)}</p>
 
                          <div className="pt-1 flex items-center gap-2 text-[11px] font-bold text-[var(--muted-strong)]">
                            <span className="inline-flex items-center gap-1 text-cyan-300 font-semibold">
                              <MapPin size={11} className="shrink-0" />
                              {formatDistance(place.distance)}
                            </span>
                            <span className="text-slate-600 font-normal">•</span>
                            <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                              <Star size={11} className="fill-amber-300 text-amber-300 shrink-0" />
                              {place.rating}
                            </span>
                            <span className="text-slate-600 font-normal">•</span>
                            <span className="text-slate-400 font-semibold">{place.priceRange ?? "Varies"}</span>
                          </div>
                        </div>
                      </button>
 
                      {active && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailsPlace(place)}
                            className="flex-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-black text-[var(--primary-foreground)] cursor-pointer"
                          >
                            View Details
                          </button>
                          {tripRoutePath && (
                            <button
                              type="button"
                              onClick={() => handleAddStopToTrip(place)}
                              className="flex-1 rounded-lg border border-teal-500/35 bg-teal-500/10 px-3 py-2 text-xs font-black text-teal-300 hover:bg-teal-500/20 transition cursor-pointer"
                            >
                              + Add to Trip
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {sortedPlaces.length > visiblePlacesCount && (
                  <button
                    type="button"
                    onClick={() => setVisiblePlacesCount((prev) => prev + 15)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] py-3 text-center text-xs font-black uppercase tracking-widest text-[var(--muted-strong)] hover:text-white hover:border-teal-500/30 transition duration-150 cursor-pointer"
                  >
                    Show More (+{sortedPlaces.length - visiblePlacesCount} spots)
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* SHEHER TRIP PLANNER CONTROLS */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 space-y-4 shadow-xl">
                <div>
                  <h2 className="font-black text-[var(--foreground)] text-base">Plan a Trip</h2>
                  <p className="text-xs text-[var(--muted)] mt-0.5">Plot a route & discover essential stops along the way.</p>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] block mb-1">Source (A)</label>
                    <input
                      type="text"
                      value={tripSource}
                      onChange={(e) => setTripSource(e.target.value)}
                      placeholder="e.g. Pune"
                      className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] block mb-1">Destination (B)</label>
                    <input
                      type="text"
                      value={tripDest}
                      onChange={(e) => setTripDest(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handlePlanTrip(tripSource, tripDest)}
                  disabled={tripLoading}
                  className="w-full bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-black uppercase tracking-widest py-3 rounded-lg hover:scale-[1.01] active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {tripLoading ? "Calculating Route..." : "🗺️ Get Route & Stops"}
                </button>

                <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                    Trip name
                  </label>
                  <input
                    type="text"
                    value={tripPlanName}
                    onChange={(event) => setTripPlanName(event.target.value)}
                    placeholder={`${tripSource} to ${tripDest}`}
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-cyan-400"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={saveTripPlan}
                      disabled={tripSaveStatus === "saving" || !tripRoutePath}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-black text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={14} />
                      {tripSaveStatus === "saving" ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={shareTripPlan}
                      disabled={!tripRoutePath}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs font-black text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeTripPlanId ? <Share2 size={14} /> : <Copy size={14} />}
                      Share
                    </button>
                  </div>
                  {tripSaveMessage && (
                    <p className={`mt-2 text-xs font-semibold ${tripSaveStatus === "error" ? "text-rose-300" : "text-emerald-300"}`}>
                      {tripSaveMessage}
                    </p>
                  )}
                  {!user && (
                    <div className="mt-2 text-[10px] font-black uppercase text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg text-center flex items-center justify-center gap-1.5">
                      <span>⚠️ Guest Trail: Log in to save to profile</span>
                    </div>
                  )}
                </div>

                {tripError && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                    <ShieldAlert size={14} className="shrink-0" />
                    <span>{tripError}</span>
                  </div>
                )}

                {/* Popular Route Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] block">Iconic Highway Presets</span>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-fade-right">
                    {Object.entries(ROUTE_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setTripSource(preset.start.name);
                          setTripDest(preset.end.name);
                          handlePlanTrip(preset.start.name, preset.end.name);
                        }}
                        className="shrink-0 bg-[var(--panel-soft)] border border-[var(--border)] text-[var(--muted-strong)] text-[10px] font-bold px-2.5 py-1.5 rounded-full hover:bg-[var(--panel-strong)] hover:text-[var(--foreground)] transition cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ROUTE STATS & CONTROLS HUD */}
              {tripRoutePath && tripStats && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-cyan-400/20 bg-cyan-950/10 p-4 space-y-3.5 shadow-lg backdrop-blur-sm">
                    <div className="grid grid-cols-3 gap-2.5 text-left">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300/80">Distance</span>
                        <div className="text-base font-black text-[var(--foreground)] mt-0.5">{tripStats.distance} km</div>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300/80">Est. Time</span>
                        <div className="text-base font-black text-[var(--foreground)] mt-0.5">
                          {Math.floor(tripStats.duration / 60)}h {tripStats.duration % 60}m
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-300/85">Est. Tolls</span>
                        <div className="text-base font-black text-amber-300 mt-0.5">
                          ₹{estimatedToll}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-cyan-400/10 pt-2.5 flex items-center justify-between gap-2">
                      <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300/85">Vehicle Type</span>
                      <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-md p-0.5">
                        {[
                          { id: "car", label: "Car" },
                          { id: "suv", label: "SUV" },
                          { id: "lcv", label: "LCV" },
                        ].map((v) => {
                          const active = vehicleType === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setVehicleType(v.id as any)}
                              className={`px-2 py-0.5 text-[9px] font-black rounded transition duration-150 cursor-pointer ${
                                active
                                  ? "bg-cyan-400 text-slate-950"
                                  : "text-slate-400 hover:text-white"
                              }`}
                            >
                              {v.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-cyan-400/10 pt-3 flex items-center justify-between gap-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                        ⚡ Cruise Simulation
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (simulationIndex >= tripRoutePath.length - 1) {
                              setSimulationIndex(0);
                            }
                            setSimulationActive(!simulationActive);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-slate-950 hover:bg-cyan-300 active:scale-90 transition cursor-pointer"
                          title={simulationActive ? "Pause Journey" : "Start Cruise"}
                        >
                          {simulationActive ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                        </button>

                        {simulationIndex > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSimulationActive(false);
                              setSimulationIndex(0);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-90 transition cursor-pointer"
                            title="Reset Journey"
                          >
                            <Square size={12} fill="currentColor" />
                          </button>
                        )}
                        
                        {simulationActive && (
                          <button
                            type="button"
                            onClick={() => {
                              setSimulationSpeed(prev => prev === 2 ? 5 : prev === 5 ? 10 : 2);
                            }}
                            className="flex h-8 px-2.5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-black text-cyan-300 hover:bg-slate-700 transition cursor-pointer"
                            title="Adjust Cruise Speed"
                          >
                            <FastForward size={11} className="mr-1" />
                            {simulationSpeed}x
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-cyan-400 h-full transition-all duration-300"
                          style={{ width: `${(simulationIndex / (tripRoutePath.length - 1)) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] font-bold text-[var(--muted)]">
                        <span>START</span>
                        <span>{Math.round((simulationIndex / (tripRoutePath.length - 1)) * 100)}% COMPLETE</span>
                        <span>END</span>
                      </div>
                    </div>
                  </div>

                  {/* OPTIMIZATION FEEDBACK BANNER */}
                  {optimizationFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs font-bold text-emerald-300 text-center shadow-md"
                    >
                      {optimizationFeedback}
                    </motion.div>
                  )}

                  {/* WEATHER OPTIMIZER & DEPARTURE WIDGET */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4 space-y-3 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">🌤️ Departure Forecast</span>
                      </div>
                      <span className="text-[10px] font-bold text-[var(--muted-strong)] uppercase">
                        {activeCity} Time
                      </span>
                    </div>

                    {/* Poetic forecast helper */}
                    <div className="bg-[var(--panel-strong)] border border-[var(--border)] rounded-md p-2 text-xs leading-relaxed text-[var(--muted-strong)] font-semibold">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-[var(--foreground)] text-[11px]">
                          {selectedWeather.label} ({selectedWeather.temp}°C)
                        </span>
                        <span className="text-[9px] font-black text-cyan-400 bg-cyan-400/5 px-1.5 py-0.5 rounded border border-cyan-400/10">
                          {selectedWeather.condition}
                        </span>
                      </div>
                      <p className="text-[10px] leading-normal text-[var(--muted)] font-medium">{selectedWeather.poeticNote}</p>
                    </div>

                    {/* Horizontal 6-hour bar */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                      {hourlyWeatherForecast.map((fc) => {
                        const isSelected = fc.hourValue === simulatedDepartureHour;
                        const iconMap = {
                          Pleasant: <Sun size={13} className="text-amber-300" />,
                          Rainy: <CloudRain size={13} className="text-cyan-300 animate-bounce" />,
                          Hot: <Sun size={13} className="text-rose-400" />,
                          Cozy: <ThermometerSnowflake size={13} className="text-sky-300" />,
                        };
                        const conditionColorMap = {
                          Pleasant: "border-amber-500/20 text-amber-300 hover:bg-amber-500/5",
                          Rainy: "border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/5",
                          Hot: "border-rose-500/20 text-rose-300 hover:bg-rose-500/5",
                          Cozy: "border-sky-500/20 text-sky-300 hover:bg-sky-500/5",
                        };
                        const conditionIcon = iconMap[fc.weather.condition as keyof typeof iconMap] || <Cloud size={13} />;
                        
                        return (
                          <button
                            key={fc.time}
                            type="button"
                            onClick={() => setSimulatedDepartureHour(fc.hourValue)}
                            className={cn(
                              "flex flex-col items-center gap-1 p-2 rounded-md border min-w-[4.2rem] shrink-0 transition-all text-[9px] font-black cursor-pointer",
                              isSelected
                                ? "bg-cyan-400 border-cyan-400 text-slate-950 scale-105 shadow-sm font-black"
                                : `bg-[var(--panel)] text-[var(--muted)] ${conditionColorMap[fc.weather.condition as keyof typeof conditionColorMap]}`
                            )}
                          >
                            <span>{fc.time}</span>
                            {isSelected ? <Clock size={11} className="animate-pulse" /> : conditionIcon}
                            <span>{fc.weather.temp}°C</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* RAINY WEATHER ALTERNATIVE WARNING */}
                    {weatherAlternativeAlert && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5"
                      >
                        <p className="text-[10px] font-bold text-amber-300 leading-relaxed">
                          {weatherAlternativeAlert}
                        </p>
                        <button
                          type="button"
                          onClick={handleSwapToIndoorSpots}
                          className="w-full flex items-center justify-center gap-1.5 rounded bg-amber-400 px-2.5 py-1.5 text-[10px] font-black text-slate-950 hover:bg-amber-300 transition duration-150 cursor-pointer shadow"
                        >
                          Swap to Indoor Spots ☕
                        </button>
                      </motion.div>
                    )}
                  </div>

                  {/* PREMIUM OPTIMIZE BUTTON */}
                  {tripStops.length > 2 && (
                    <button
                      type="button"
                      onClick={handleOptimizeRoute}
                      className="w-full relative overflow-hidden group rounded-lg border border-cyan-400/30 bg-cyan-950/10 p-3 flex items-center justify-center gap-2 cursor-pointer transition hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-400/5 active:scale-[0.98]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/5 to-teal-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
                        Optimize Itinerary Order ⚡
                      </span>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                        TSP
                      </span>
                    </button>
                  )}

                  {/* STOPS FILTER CHIPS */}
                  <div className="flex gap-1 overflow-x-auto no-scrollbar scroll-fade-right bg-[var(--panel-soft)] p-2 rounded-lg border border-[var(--border)]">
                    {[
                      { id: "all", label: "All Stops" },
                      { id: "food", label: "🍔 Eateries" },
                      { id: "ev", label: "⚡ EV Charging" },
                      { id: "toilet", label: "🚻 Restrooms" },
                      { id: "scenic", label: "📸 Scenic Stops" }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedTripCategory(cat.id as any)}
                        className={cn(
                          "shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all",
                          selectedTripCategory === cat.id
                            ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)] shadow-sm"
                            : "bg-[var(--panel)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--panel-strong)]"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* STOPS LIST FEED */}
                  <div className="space-y-3">
                    {filteredTripStops.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-[var(--border)] rounded-lg bg-[var(--panel-soft)]">
                        <p className="text-xs text-[var(--muted)] font-medium">No pitstops matching filter on this route.</p>
                      </div>
                    ) : (
                      <Reorder.Group 
                        axis="y" 
                        values={tripStops} 
                        onReorder={(newOrder) => {
                          setTripStops(newOrder);
                          recalculateRouteForStops(newOrder);
                        }}
                        className="space-y-3"
                      >
                        {filteredTripStops.map((stop, idx) => {
                          const isFocused = focusedPlace?.id === stop.id;
                          return (
                            <Reorder.Item
                              key={stop.id}
                              value={stop}
                              className={cn(
                                "w-full rounded-lg border p-3 text-left transition select-none flex items-start gap-2 cursor-grab active:cursor-grabbing",
                                isFocused
                                  ? "border-cyan-400 bg-cyan-400/5 shadow-md"
                                  : "border-[var(--border)] bg-[var(--panel-soft)] hover:bg-[var(--panel)]"
                              )}
                            >
                              {/* Drag Handle Indicator */}
                              <div className="pt-2 text-slate-500 shrink-0 cursor-grab active:cursor-grabbing">
                                <GripVertical size={16} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFocusedPlace(stop);
                                    setMapCenter({ latitude: stop.latitude, longitude: stop.longitude });
                                  }}
                                  className="w-full text-left cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                                        Stop {idx + 1} · {getCategoryLabel(stop.category, stop.tags)}
                                      </p>
                                      <h3 className="mt-1 line-clamp-1 font-black text-[var(--foreground)] text-sm">{stop.title}</h3>
                                      <p className="mt-1 line-clamp-2 text-xs font-semibold text-[var(--muted-strong)]">{formatPlaceArea(stop)}</p>
                                    </div>
                                    <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-500/20">
                                      ★ {stop.rating}
                                    </span>
                                  </div>

                                  <p className="mt-2 text-xs text-[var(--muted-strong)] line-clamp-2 leading-relaxed font-semibold">
                                    {stop.description}
                                  </p>

                                  <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-[var(--muted-strong)] border-t border-[var(--border)] pt-2.5">
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin size={11} className="text-cyan-300" />
                                      <span className="line-clamp-1">{formatPlaceArea(stop)}</span>
                                    </span>
                                    <span className="font-black text-cyan-400 uppercase tracking-wider">
                                      {stop.priceRange}
                                    </span>
                                  </div>
                                </button>

                                {isFocused && (
                                  <button
                                    type="button"
                                    onClick={() => setDetailsPlace(stop)}
                                    className="mt-3 w-full rounded-lg bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300 transition active:scale-[0.98] cursor-pointer"
                                  >
                                    View Detailed Info
                                  </button>
                                )}
                              </div>

                              {/* Sidebar Controls (Move Up, Move Down, Delete) */}
                              <div className="flex flex-col items-center gap-1.5 shrink-0 border-l border-white/5 pl-2 ml-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveStop(idx, "up")}
                                  className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition cursor-pointer"
                                  title="Move Up"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === filteredTripStops.length - 1}
                                  onClick={() => handleMoveStop(idx, "down")}
                                  className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition cursor-pointer"
                                  title="Move Down"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStop(stop.id)}
                                  className="p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition mt-1 cursor-pointer"
                                  title="Remove Stop"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </Reorder.Item>
                          );
                        })}
                      </Reorder.Group>
                    )}
                  </div>
                </div>
              )}

              {savedTripPlans.length > 0 && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-black text-[var(--foreground)]">Saved Trips</h2>
                      <p className="text-xs font-semibold text-[var(--muted)]">Reload a route or share it later.</p>
                    </div>
                    <button
                      type="button"
                      onClick={loadSavedTripPlans}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-black text-[var(--muted-strong)]"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-2">
                    {savedTripPlans.slice(0, 4).map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => applySavedTripPlan(plan)}
                        className={cn(
                          "w-full rounded-lg border p-3 text-left transition hover:bg-[var(--panel-soft)]",
                          activeTripPlanId === plan.id ? "border-cyan-400/60 bg-cyan-400/10" : "border-[var(--border)] bg-[var(--panel-soft)]"
                        )}
                      >
                        <p className="line-clamp-1 text-sm font-black text-[var(--foreground)]">{plan.name}</p>
                        <p className="mt-1 line-clamp-1 text-xs font-semibold text-[var(--muted)]">
                          {plan.source} to {plan.destination}
                        </p>
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-300">
                          {plan.distanceKm ?? "-"} km - {plan.stops.length} stops
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* MERCHANT FLASH DEAL SIMULATOR CONSOLE */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-950/5 p-4 space-y-3 shadow mt-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">🏢 Merchant Demo Console</span>
              <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[8px] font-black text-purple-300 uppercase tracking-wider">
                Simulation Mode
              </span>
            </div>
            <p className="text-[10px] text-[var(--muted-strong)] leading-relaxed font-semibold">
              Simulate launching a 50% discount deal from a local business. Select a spot in the city:
            </p>

            <div className="space-y-2">
              <select
                id="merchant-place-select"
                aria-label="Select merchant place"
                className="w-full h-8 rounded border border-[var(--border)] bg-[var(--input)] text-xs font-semibold px-2 text-[var(--foreground)] outline-none"
              >
                {allPlaces.slice(0, 10).map((p) => (
                  <option key={p.id} value={`${p.id}|${p.title}`}>
                    {p.title} ({p.locality})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  const selectEl = document.getElementById("merchant-place-select") as HTMLSelectElement;
                  if (!selectEl) return;
                  const [placeId, placeTitle] = selectEl.value.split("|");
                  
                  try {
                    const res = await fetch("/api/deals/launch", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        placeId,
                        placeTitle,
                        discountPercentage: 50,
                        description: `🔥 50% OFF FLASH DEAL! Grab 50% off on all specialty coffee, pastries, and main courses at ${placeTitle} for the next 45 minutes.`
                      })
                    });
                    if (res.ok) {
                      // Success is broadcasted and displays in notification
                    } else {
                      alert("Please log in first before simulating merchant launches.");
                    }
                  } catch (err) {
                    alert("API connection failed.");
                  }
                }}
                className="w-full rounded bg-purple-600 hover:bg-purple-500 py-1.5 text-center text-[10px] font-black text-white cursor-pointer transition"
              >
                Launch 50% Flash Deal! 🚀
              </button>
            </div>
          </div>
          </div>
        </aside>
      </div>
    </div>

      <PlaceDetailModal place={detailsPlace} onClose={() => setDetailsPlace(null)} />
      <SuggestPlaceModal
        isOpen={isSuggestModalOpen}
        onClose={() => setIsSuggestModalOpen(false)}
        defaultCity={activeCity}
        defaultCoords={mapCenter || { latitude: activeLocation.latitude, longitude: activeLocation.longitude }}
      />

      {/* Share Itinerary Modal */}
      {isShareModalOpen && tripStats && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[800] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            className="relative w-full max-w-lg rounded-2xl border border-teal-500/30 bg-slate-950 p-6 text-center shadow-2xl z-40 max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <button
              type="button"
              onClick={() => {
                setIsShareModalOpen(false);
                setCopyShareMessage("");
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="mb-4 flex flex-col items-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 shadow-inner">
                <Share2 size={24} className="animate-pulse" />
              </div>
              <h3 className="mt-3 text-lg font-black text-white">Share Your Trip Itinerary</h3>
              <p className="text-xs font-semibold text-slate-400 mt-1">Copy WhatsApp text or get a direct map route link</p>
            </div>

            {/* Boarding Pass Summary Card */}
            <div className="relative border border-teal-500/25 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 rounded-xl p-5 text-left overflow-hidden mb-5 shadow-inner">
              {/* Decorative ticket cutout punches */}
              <div className="absolute left-0 top-[60%] -translate-y-1/2 -translate-x-3 h-6 w-6 rounded-full bg-slate-950 border border-teal-500/20 z-10" />
              <div className="absolute right-0 top-[60%] -translate-y-1/2 translate-x-3 h-6 w-6 rounded-full bg-slate-950 border border-teal-500/20 z-10" />

              {/* TICKET MAIN SECTION */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-300">SHEHER CITY EXPRESS</span>
                  </div>
                  <span className="text-[8px] font-black tracking-widest text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                    BOARDING PASS
                  </span>
                </div>

                {/* Airport style code routing */}
                <div className="flex items-center justify-between py-1">
                  <div className="text-left flex flex-col items-start">
                    <div className="text-3xl font-black text-white tracking-wider">{getCityIATA(tripSource)}</div>
                    <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mt-0.5">{tripSource}</div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAirportCode(getCityIATA(tripSource));
                        setIsAirportGuideOpen(true);
                      }}
                      className="mt-1.5 flex items-center gap-1 text-[8px] font-black uppercase text-teal-400 hover:text-teal-300 transition tracking-wider bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20 cursor-pointer"
                    >
                      Explore {getCityIATA(tripSource)} ✈️
                    </button>
                  </div>
                  <div className="flex flex-col items-center flex-1 px-4 relative">
                    <div className="w-full border-t border-dashed border-teal-500/30 relative">
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-950 px-2 text-teal-300 text-xs">
                        ✈
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="text-3xl font-black text-white tracking-wider">{getCityIATA(tripDest)}</div>
                    <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mt-0.5">{tripDest}</div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAirportCode(getCityIATA(tripDest));
                        setIsAirportGuideOpen(true);
                      }}
                      className="mt-1.5 flex items-center gap-1 text-[8px] font-black uppercase text-amber-400 hover:text-amber-300 transition tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 cursor-pointer"
                    >
                      Explore {getCityIATA(tripDest)} ✈️
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-b border-white/5 py-3 text-xs font-bold text-slate-400">
                  <div className="space-y-1">
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 font-black">Passenger</span>
                    <div className="text-xs font-black text-white uppercase truncate">
                      {user?.fullName || "GUEST EXPLORER"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-right">
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase tracking-wider text-slate-500 font-black">Gate</span>
                      <div className="text-xs font-black text-white">18A</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase tracking-wider text-slate-500 font-black">Class</span>
                      <div className="text-xs font-black text-amber-300">EXPLR</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Perforation divider line */}
              <div className="border-t border-dashed border-slate-700/60 my-4 relative" />

              {/* TICKET STUB / PITSTOPS SECTION */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pitstops Stub</span>
                  <span className="text-[9px] font-black text-teal-300">{tripStops.length} Spots</span>
                </div>
                
                <div className="space-y-1.5 max-h-24 overflow-y-auto no-scrollbar">
                  {tripStops.map((stop, idx) => (
                    <div key={stop.id} className="flex items-center justify-between text-[11px] leading-tight">
                      <div className="flex items-center gap-1.5 truncate pr-4">
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-teal-400/10 text-teal-300 flex items-center justify-center text-[8px] font-black">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-200 truncate">{stop.title}</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide shrink-0">
                        {stop.priceRange || "$$"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-3 text-[10px] font-bold text-slate-400">
                  <div>
                    <span className="text-[8px] uppercase text-slate-500 block">Distance</span>
                    <span className="text-white font-black">{tripStats.distance} km</span>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase text-slate-500 block">Boarding</span>
                    <span className="text-white font-black">
                      {Math.floor(tripStats.duration / 60)}h {tripStats.duration % 60}m
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] uppercase text-slate-500 block">Tolls Est</span>
                    <span className="text-amber-300 font-black">₹{estimatedToll}</span>
                  </div>
                </div>

                {/* CSS Barcode stub */}
                <div className="pt-4 flex flex-col items-center gap-1.5">
                  <div className="flex items-center justify-center gap-[1px] h-10 w-full bg-white/5 rounded p-1.5 overflow-hidden opacity-60">
                    {[1,2,1,3,1,2,4,1,2,1,3,2,1,4,1,2,3,1,2,1,4,2,1,2,3,1,2,1,4].map((width, i) => (
                      <div
                        key={i}
                        className="bg-slate-300 h-full shrink-0"
                        style={{ width: `${width}px` }}
                      />
                    ))}
                  </div>
                  <span className="text-[8px] tracking-[0.25em] font-mono text-slate-500 uppercase">
                    SH-{Math.round(tripStats.distance * 100)}-{tripStops.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const shareUrl = activeTripPlanId 
                      ? `${window.location.origin}/trip/${activeTripPlanId}` 
                      : `${window.location.origin}/map?mode=trip&stops=${encodeURIComponent(tripStops.map(s => s.id).join(","))}&sourceName=${encodeURIComponent(tripSource)}&destName=${encodeURIComponent(tripDest)}&trailName=${encodeURIComponent(tripPlanName)}`;
                    await navigator.clipboard.writeText(shareUrl);
                    setCopyShareMessage("Map route link copied to clipboard!");
                  }}
                  className="rounded-xl bg-teal-400 py-3 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-teal-350 active:scale-98 transition duration-150 cursor-pointer shadow-lg shadow-teal-500/15"
                >
                  🔗 Copy Link
                </button>

                <button
                  type="button"
                  onClick={handleGeneratePostcard}
                  className="rounded-xl border border-amber-400/40 bg-amber-500/10 py-3 text-xs font-black uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 active:scale-98 transition duration-150 cursor-pointer"
                >
                  📸 Save Card
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const waText = generateWhatsAppShareText();
                  await navigator.clipboard.writeText(waText);
                  setCopyShareMessage("WhatsApp formatted text copied! Ready to paste.");
                }}
                className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-xs font-black uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/20 active:scale-98 transition duration-150 cursor-pointer"
              >
                💬 Copy for WhatsApp (Emoji Rich)
              </button>

              {postcardMessage && (
                <div className="text-xs font-black text-amber-300 bg-amber-400/10 border border-amber-400/20 p-2.5 rounded-lg text-center animate-slide-down">
                  {postcardMessage}
                </div>
              )}

              {copyShareMessage && (
                <div className="text-xs font-black text-teal-300 bg-teal-400/10 border border-teal-400/20 p-2.5 rounded-lg text-center animate-slide-down">
                  {copyShareMessage}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Airport layover companion guide modal */}
      {isAirportGuideOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[900] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="relative w-full max-w-lg rounded-2xl border border-amber-500/30 bg-slate-950 p-6 shadow-2xl z-50 max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <button
              type="button"
              onClick={() => setIsAirportGuideOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="mb-5 flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <Plane size={24} className="rotate-45" />
              </div>
              <div className="text-left">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-400">SHEHER TERMINAL COMPANION</span>
                <h3 className="text-lg font-black text-white leading-tight">
                  {AIRPORT_GUIDES[selectedAirportCode]?.name || `${selectedAirportCode} International Airport`}
                </h3>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">
                  {AIRPORT_GUIDES[selectedAirportCode]?.terminal || "All Terminals"} · {AIRPORT_GUIDES[selectedAirportCode]?.city}
                </p>
              </div>
            </div>

            {/* Time-Budget Selector Tabs */}
            <div className="mb-5">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2 text-left">
                Select your remaining layover time:
              </span>
              <div className="grid grid-cols-3 gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                {[
                  { id: "quick", label: "< 1 Hour", desc: "Quick Grab" },
                  { id: "medium", label: "1-3 Hours", desc: "Relax & Dine" },
                  { id: "long", label: "3+ Hours", desc: "Sleep & Spa" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLayoverTimeBucket(tab.id as any)}
                    className={cn(
                      "flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-bold transition cursor-pointer",
                      layoverTimeBucket === tab.id
                        ? "bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/10"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[8px] opacity-75 font-semibold mt-0.5">{tab.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recommendations Content */}
            <div className="space-y-4 mb-6">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block text-left">
                Curated Recommendations:
              </span>
              
              {AIRPORT_GUIDES[selectedAirportCode]?.layovers[layoverTimeBucket]?.length > 0 ? (
                AIRPORT_GUIDES[selectedAirportCode].layovers[layoverTimeBucket].map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex gap-3 bg-white/5 p-4 rounded-xl border border-white/5 text-left items-start hover:border-amber-400/20 transition duration-150"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-amber-300 text-xs font-black">
                      {idx === 0 ? <Coffee size={14} /> : idx === 1 ? <ShoppingBag size={14} /> : <Bed size={14} />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-black text-white leading-snug">{rec.title}</h4>
                        {rec.isPremium && (
                          <span className="text-[8px] font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                            Premium Benefit
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">{rec.description}</p>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        <MapPin size={10} />
                        <span>{rec.location}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-xs font-bold text-slate-400">No custom recommendations configured for this duration.</p>
                </div>
              )}
            </div>

            {/* Premium Lounge Access Section */}
            {AIRPORT_GUIDES[selectedAirportCode]?.lounges && (
              <div className="border border-amber-500/20 bg-gradient-to-br from-slate-900 to-amber-950/20 rounded-xl p-4 text-left">
                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">Sheher Premium Lounge Access</span>
                  </div>
                  <span className="text-[8px] font-black tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    VIP LOUNGE
                  </span>
                </div>

                {AIRPORT_GUIDES[selectedAirportCode].lounges.map((lounge, lIdx) => (
                  <div key={lIdx} className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-black text-white">{lounge.name}</h4>
                        <p className="text-[10px] text-slate-400 font-semibold">{lounge.location}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {lounge.amenities.slice(0, 4).map((amenity, aIdx) => (
                        <span key={aIdx} className="text-[8px] font-black text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/5 uppercase">
                          ✓ {amenity}
                        </span>
                      ))}
                    </div>

                    {/* Check if user is premium */}
                    {user?.isPremiumPass ? (
                      <div className="bg-amber-400 text-slate-950 rounded-lg p-3 text-center border border-amber-500 mt-2">
                        <div className="text-[9px] font-black tracking-wider uppercase opacity-75">Your Exclusive Coupon Code</div>
                        <div className="text-base font-black tracking-[0.1em] font-mono select-all my-0.5">
                          {lounge.couponCode || "SHEHER-VIP"}
                        </div>
                        <p className="text-[9px] font-bold leading-tight mt-0.5">
                          {lounge.premiumBenefit}
                        </p>
                      </div>
                    ) : (
                      <div className="relative rounded-lg p-3 border border-white/10 bg-slate-900/60 backdrop-blur-sm mt-2 text-center overflow-hidden">
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] flex flex-col justify-center items-center p-2 text-center">
                          <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">🔒 EXCLUSIVE BENEFIT</span>
                          <p className="text-[10px] text-slate-300 font-bold leading-tight max-w-[280px] my-1">
                            Upgrade to the **Sheher Pass** to unlock free lounge coupons and premium discounts.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAirportGuideOpen(false);
                              setIsShareModalOpen(false);
                              router.push("/profile");
                            }}
                            className="mt-1 rounded bg-amber-400 px-2.5 py-1 text-[9px] font-black uppercase text-slate-950 hover:bg-amber-350 active:scale-95 transition cursor-pointer"
                          >
                            Get Sheher Pass 💳
                          </button>
                        </div>
                        {/* Teaser placeholder for background blur */}
                        <div className="filter blur-[3px] select-none opacity-40">
                          <div className="text-[9px] font-black uppercase text-amber-300">COUPON CODE</div>
                          <div className="text-base font-black font-mono">XXXX-XXXX-XXXX</div>
                          <p className="text-[9px] font-bold">Details restricted to Sheher Pass holders</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
