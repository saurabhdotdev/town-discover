"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Car,
  Coffee,
  Compass,
  IceCreamCone,
  LocateFixed,
  MapPin,
  Martini,
  Search,
  Sparkles,
  Store,
  UtensilsCrossed,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  Plane,
  ShoppingBag,
  Bed,
  CloudRain,
  Radio,
  Sun,
  ThermometerSnowflake,
  Cloud,
  Zap
} from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/common/BrandMark";
import { CitySwitcher } from "@/components/common/CitySwitcher";
import { LocationPermissionCard } from "@/components/common/LocationPermissionCard";
import { MoodPicker } from "@/components/common/MoodPicker";
import { LazyImage } from "@/components/common/LazyImage";
import { DiscoverySection } from "@/components/cards/DiscoverySection";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import dynamic from "next/dynamic";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLivePlaces } from "@/hooks/useLivePlaces";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { MOCK_PLACES, getPlacesWithDistance } from "@/data/mock-places";
import { getFallbackPlacesForCity } from "@/lib/client/fallback-places";
import { Place, PlaceCategory } from "@/types";
import { cn, getCategoryLabel, isVegetarianPlace } from "@/lib/utils";
import { CITY_CENTERS, getCityFromQuery, stripCityFromQuery } from "@/lib/pune-location";
import { useCitySelection } from "@/hooks/useCitySelection";
import { useMoodSelection } from "@/hooks/useMoodSelection";
import { getMoodLabel, getTopMoodRecommendations, inferMoodProfile, getMoodMatchScore } from "@/lib/mood-recommendations";
import { combineLiveAndCuratedPlaces } from "@/lib/combine-places";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getCityWeather, filterPlacesByWeather } from "@/lib/weather";
import { SwipeVibeMode } from "@/components/common/SwipeVibeMode";

const MapView = dynamic(() => import("@/components/map/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] min-h-[320px] rounded-lg bg-[var(--panel-soft)] border border-[var(--border)] animate-pulse flex items-center justify-center text-sm font-semibold text-[var(--muted)]">
      Loading interactive map...
    </div>
  ),
});
import { filterAndRankPlaces } from "@/lib/place-search";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

type CategoryFilter = "all" | "free" | "night-drive" | PlaceCategory;
type SortMode = "recommended" | "distance" | "rating";

const categories: { id: CategoryFilter; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: <Sparkles size={17} /> },
  { id: "night-drive", label: "Night Drives", icon: <Car size={17} /> },
  { id: "ice-cream", label: "Ice Cream", icon: <IceCreamCone size={17} /> },
  { id: "cafe", label: "Cafes", icon: <Coffee size={17} /> },
  { id: "restaurant", label: "Restaurants", icon: <UtensilsCrossed size={17} /> },
  { id: "event", label: "Events", icon: <CalendarDays size={17} /> },
  { id: "bar", label: "Bars", icon: <Martini size={17} /> },
  { id: "food-stall", label: "Street Food", icon: <Store size={17} /> },
];

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
        { title: "Scentido Luxury Perfumery", description: "Try exotic niche perfumes from global designers.", location: "Duty Free Walkway" }
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

const getCityIATA = (cityName: string): string => {
  const normalized = cityName.toLowerCase().trim();
  if (normalized.includes("pune")) return "PNQ";
  if (normalized.includes("mumbai") || normalized.includes("bombay")) return "BOM";
  if (normalized.includes("bangalore") || normalized.includes("bengaluru")) return "BLR";
  if (normalized.includes("delhi")) return "DEL";
  return "";
};

export default function DiscoverPage() {
  const {
    location,
    loading: locationLoading,
    error: locationError,
    source: locationSource,
    city: detectedCity,
    requestLocation,
  } = useGeolocation();
  const { selectedCity, hasChosenCity, chooseCity, preferDetectedCity } = useCitySelection();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const { savedPlaceIds, savedPlaces, toggleSave } = useSavedPlaces();
  const { selectedMood, setSelectedMood } = useMoodSelection();

  // Advanced Filters State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [selectedPrice, setSelectedPrice] = useState<string>("all");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Spotlight Banner State
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  // Router and Auth
  const router = useRouter();
  const { user } = useAuth();

  // Sheher Airport Companion State
  const [isAirportGuideOpen, setIsAirportGuideOpen] = useState(false);
  const [selectedAirportCode, setSelectedAirportCode] = useState<string>("BOM");
  const [layoverTimeBucket, setLayoverTimeBucket] = useState<"quick" | "medium" | "long">("quick");
  
  // Swipe & Vibe Mode
  const [swipeMode, setSwipeMode] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleFocusSearch = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };

    window.addEventListener("focus-discover-search", handleFocusSearch);

    const params = new URLSearchParams(window.location.search);
    if (params.get("focus") === "true") {
      const timer = setTimeout(() => {
        handleFocusSearch();
      }, 300);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener("focus-discover-search", handleFocusSearch);
    };
  }, []);

  const activeCity = getCityFromQuery(query) ?? (!hasChosenCity && locationSource === "browser" ? detectedCity : selectedCity);
  const activeAirportCode = getCityIATA(activeCity);
  const queryLocation = CITY_CENTERS[activeCity];
  const distanceReference = locationSource === "browser" && location && activeCity === detectedCity ? location : queryLocation;

  const savedPlacesInCity = useMemo(() => {
    const resolved = savedPlaces.filter((p) => p.city.toLowerCase() === activeCity.toLowerCase());
    return getPlacesWithDistance(resolved, distanceReference);
  }, [savedPlaces, activeCity, distanceReference]);
  const activeLocation = queryLocation;
  const liveQuery = query.trim() || activeCity;
  const { places: livePlaces, loading: livePlacesLoading, error: livePlacesError } = useLivePlaces(activeLocation, liveQuery);

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

  const rawPlaces = useMemo(
    () =>
      getPlacesWithDistance(combineLiveAndCuratedPlaces(livePlaces, curatedPlaces), distanceReference),
    [distanceReference, curatedPlaces, livePlaces]
  );

  const allPlaces = useMemo(() => {
    if (vegOnly) {
      return rawPlaces.filter(isVegetarianPlace);
    }
    return rawPlaces;
  }, [rawPlaces, vegOnly]);

  const vibeScores = useMemo(() => {
    const scores: Record<string, number> = {};
    if (!selectedMood) return scores;

    const mood = inferMoodProfile({ explicitMood: selectedMood, now });
    allPlaces.forEach((place) => {
      const rawScore = getMoodMatchScore(place, mood, now);
      const percentage = Math.round(
        Math.min(99, Math.max(70, 70 + (rawScore * 25)))
      );
      scores[place.id] = percentage;
    });

    return scores;
  }, [allPlaces, selectedMood, now]);

  const weather = useMemo(() => {
    const city = (activeCity || "Pune") as any;
    return getCityWeather(city, now);
  }, [activeCity, now]);

  const weatherPicks = useMemo(() => {
    return filterPlacesByWeather(allPlaces, weather.condition).slice(0, 12);
  }, [allPlaces, weather.condition]);

  const hasFilters =
    Boolean(query.trim()) ||
    activeCategory !== "all" ||
    openOnly ||
    vegOnly ||
    sortMode !== "recommended" ||
    selectedRating > 0 ||
    selectedPrice !== "all" ||
    selectedTags.size > 0;

  const locationLabel = locationLoading
    ? "Finding location"
    : locationSource === "browser" && activeCity === detectedCity
      ? `Near you in ${activeCity}`
      : usingLivePlaces
        ? `Live + curated ${activeCity}`
        : `Curated ${activeCity} places`;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const normalizedQuery = stripCityFromQuery(debouncedQuery).toLowerCase();

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const filteredPlaces = useMemo(() => {
    let results = filterAndRankPlaces(allPlaces, {
      query: normalizedQuery,
      category: activeCategory,
      openOnly,
      now,
      explicitMood: selectedMood,
      useMoodRanking: selectedMood != null && sortMode === "recommended",
    });

    // Rating Filter
    if (selectedRating > 0) {
      results = results.filter((p) => p.rating >= selectedRating);
    }

    // Price Filter
    if (selectedPrice !== "all") {
      results = results.filter((p) => p.priceRange === selectedPrice);
    }

    // Tags Filter
    if (selectedTags.size > 0) {
      results = results.filter((p) =>
        Array.from(selectedTags).every((tag) => p.tags.includes(tag))
      );
    }

    const sortedResults = [...results].sort((a, b) => {
      if (sortMode === "distance") return a.distance - b.distance;
      if (sortMode === "rating") return b.rating - a.rating;
      if (selectedMood && sortMode === "recommended") return 0;
      if (a.isTrending !== b.isTrending) return Number(b.isTrending) - Number(a.isTrending);
      return a.distance - b.distance;
    });

    const PAGE_SIZE = 20;
    return sortedResults.slice(0, page * PAGE_SIZE);
  }, [activeCategory, allPlaces, normalizedQuery, now, openOnly, selectedMood, sortMode, page, selectedRating, selectedPrice, selectedTags]);

  const totalFilteredCount = useMemo(() => {
    let results = filterAndRankPlaces(allPlaces, {
      query: normalizedQuery,
      category: activeCategory,
      openOnly,
      now,
      explicitMood: selectedMood,
      useMoodRanking: selectedMood != null && sortMode === "recommended",
    });

    if (selectedRating > 0) {
      results = results.filter((p) => p.rating >= selectedRating);
    }
    if (selectedPrice !== "all") {
      results = results.filter((p) => p.priceRange === selectedPrice);
    }
    if (selectedTags.size > 0) {
      results = results.filter((p) =>
        Array.from(selectedTags).every((tag) => p.tags.includes(tag))
      );
    }
    return results.length;
  }, [activeCategory, allPlaces, normalizedQuery, now, openOnly, selectedMood, sortMode, selectedRating, selectedPrice, selectedTags]);

  const handleLoadMore = useCallback(() => setPage((p) => p + 1), []);
  const hasMore = filteredPlaces.length < totalFilteredCount;

  // Pick trending or highest rated spots for the Spotlight Slideshow
  const spotlightSpots = useMemo(() => {
    const trending = allPlaces.filter((p) => p.isTrending);
    if (trending.length > 0) return trending.slice(0, 3);
    return [...allPlaces].sort((a, b) => b.rating - a.rating).slice(0, 3);
  }, [allPlaces]);

  // Spotlight slideshow rotation
  useEffect(() => {
    if (spotlightSpots.length <= 1) return;
    const interval = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % spotlightSpots.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [spotlightSpots.length]);

  const moodPicks = useMemo(() => {
    if (!selectedMood) return [];
    return getTopMoodRecommendations(allPlaces, {
      query: normalizedQuery,
      now,
      explicitMood: selectedMood,
      limit: 12,
    });
  }, [allPlaces, normalizedQuery, now, selectedMood]);

  useEffect(() => {
    const placeId = new URLSearchParams(window.location.search).get("place");
    if (!placeId || selectedPlace?.id === placeId) return;

    const linkedPlace = allPlaces.find((place) => place.id === placeId);
    if (linkedPlace) {
      setTimeout(() => {
        setSelectedPlace(linkedPlace);
      }, 0);
    } else {
      // Resolve the place dynamically if not found in the preloaded list
      fetch(`/api/places/resolve?ids=${encodeURIComponent(placeId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.places && data.places.length > 0) {
            setSelectedPlace(data.places[0]);
          }
        })
        .catch((err) => console.error("Error resolving deep-linked place:", err));
    }
  }, [allPlaces, selectedPlace?.id]);

  const defaultSections = useMemo(() => [
    ...(savedPlacesInCity.length > 0
      ? [
        {
          title: `Your Favorites in ${activeCity}`,
          description: `Quick access to your bookmarked spots in ${activeCity}.`,
          places: savedPlacesInCity,
        },
      ]
      : []),
    ...(selectedMood
      ? [
        {
          title: `Picked for your ${getMoodLabel(selectedMood).toLowerCase()} mood`,
          description: `Top ${activeCity} matches for how you're feeling — cafes, events, food, and time-pass plans.`,
          places: moodPicks,
        },
      ]
      : []),
    ...(weatherPicks.length > 0
      ? [
        {
          title: `Weather Picks: Cozy for a ${weather.label.toLowerCase()}`,
          description: `Curated spots matching the current ${weather.condition.toLowerCase()} weather in ${activeCity}.`,
          places: weatherPicks,
        },
      ]
      : []),
    {
      title: query.trim() ? "Matching Places" : `${activeCity} Places`,
      description: query.trim()
        ? usingLivePlaces
          ? "Real OpenStreetMap results for your search."
          : `Curated ${activeCity} backup results for your search.`
        : usingLivePlaces
          ? `Real OpenStreetMap results near ${activeCity}.`
          : `Curated ${activeCity} backup results while live data is unavailable.`,
      places: allPlaces.slice(0, 12),
    },
    {
      title: "Closest to You",
      description: "Sorted by distance from the city or location being used.",
      places: [...allPlaces].sort((a, b) => a.distance - b.distance).slice(0, 9),
    },
    {
      title: "Family Outings & Favorites",
      description: "Highly rated, welcoming spots perfect for family gatherings, kids, and large groups.",
      places: allPlaces.filter((place) =>
        place.tags.some(tag => ["family-friendly", "family"].includes(tag))
      ).slice(0, 9),
    },
    {
      title: "Pet-Friendly Hangouts",
      description: "Welcoming cafes and open-air spots in the city that love your furry companions as much as you do.",
      places: allPlaces.filter((place) =>
        place.tags.some(tag => ["pet-friendly"].includes(tag))
      ).slice(0, 9),
    },
    {
      title: "Visitor & Foreigner Favorites",
      description: "Top heritage points, cultural landmarks, and authentic experiences perfect for international travelers and tourists.",
      places: allPlaces.filter((place) =>
        place.tags.some(tag => ["foreigner-friendly", "tourist-friendly", "heritage", "cultural"].includes(tag))
      ).slice(0, 9),
    },
    {
      title: "Cafes and Desserts",
      description: "Coffee, sweet breaks, and work-friendly corners.",
      places: allPlaces.filter((place) => ["cafe", "dessert"].includes(place.category)).slice(0, 9),
    },
    {
      title: "🍦 Ice Cream Specials",
      description: "Scoops, sundaes, kulfi, and gelato — the best frozen treats in the city.",
      places: allPlaces.filter((place) => place.category === "ice-cream").slice(0, 9),
    },
    {
      title: "Events Tonight",
      description: "Attractions, walks, landmarks, workshops, and time-pass plans.",
      places: allPlaces.filter((place) => place.category === "event" && !place.tags.includes("night-drive")).slice(0, 15),
    },
    {
      title: "Scenic Night Drives",
      description: "Late evening cruises, sea bridges, and loop routes mapping out city road vibes.",
      places: allPlaces.filter((place) => place.tags.includes("night-drive")).slice(0, 9),
    },
    {
      title: "Nightlife and Bars",
      description: "Late plans, cocktails, and louder rooms.",
      places: allPlaces.filter((place) => ["bar", "nightlife"].includes(place.category)).slice(0, 9),
    },
  ], [savedPlacesInCity, activeCity, selectedMood, moodPicks, query, usingLivePlaces, allPlaces, weatherPicks, weather]);

  return (
    <div className="w-full max-w-full min-h-screen overflow-x-hidden">
      <header className="relative z-10 border-b border-[var(--border)] bg-[var(--nav)]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-2 px-3 py-2.5 sm:px-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-3">
          <div className="min-w-0">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fresh)]">
              <Radio size={13} />
              Discover
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-2.5 sm:gap-3">
              <BrandMark size="md" showWordmark={false} />
              <h1 className="truncate text-xl font-black leading-tight tracking-tight text-[var(--foreground)] sm:text-2xl md:text-3xl">
                Explore Nearby
              </h1>
            </div>
          </div>

          <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)] sm:text-sm">
            <LocateFixed size={15} className="shrink-0 text-[var(--brand)]" />
            <span className="truncate">{locationLabel}</span>
          </div>
        </div>
      </header>

      <div className="w-full max-w-screen-xl mx-auto px-3 py-3 sm:px-4 md:px-6 md:py-4">
        {/* Weekly Spotlight Slideshow */}
        {spotlightSpots.length > 0 && !hasFilters && (
          <section className="relative mb-5 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl md:mb-6">
            <div className="absolute inset-0 z-0 h-full w-full">
              <LazyImage
                src={spotlightSpots[spotlightIndex].image}
                alt={spotlightSpots[spotlightIndex].title}
                className="opacity-25 blur-[1px] scale-105 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--spotlight-overlay-from)] via-[var(--spotlight-overlay-via)] to-transparent" />
            </div>

            <div className="relative z-10 flex min-h-[220px] flex-col justify-between gap-5 p-4 sm:min-h-[260px] sm:p-8 md:min-h-[340px] md:flex-row md:items-end md:p-10 lg:p-12">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-teal-400 text-slate-950 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.15em]">
                    ★ Spotlight
                  </span>
                  <span className="inline-flex rounded-full bg-[var(--panel-soft)] text-[var(--fresh)] px-3 py-0.5 text-[10px] font-black uppercase border border-[var(--border)]">
                    {spotlightSpots[spotlightIndex].category}
                  </span>
                  <span className="inline-flex rounded-full bg-amber-500/10 text-amber-500 px-2 py-0.5 text-[10px] font-bold border border-amber-500/20">
                    ★ {spotlightSpots[spotlightIndex].rating}
                  </span>
                </div>

                <h3 className="text-2xl font-black leading-tight text-[var(--foreground)] sm:text-3xl md:text-4xl">
                  {spotlightSpots[spotlightIndex].title}
                </h3>
                <p className="text-[var(--muted-strong)] text-xs sm:text-sm font-semibold leading-relaxed line-clamp-3">
                  {spotlightSpots[spotlightIndex].description}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {spotlightSpots[spotlightIndex].tags.slice(0, 3).map((t) => (
                    <span key={t} className="text-[10px] bg-[var(--panel-soft)] border border-[var(--border)] text-[var(--muted)] px-2.5 py-0.5 rounded-full font-bold">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <button
                  onClick={() => setSelectedPlace(spotlightSpots[spotlightIndex])}
                  className="w-full rounded-lg bg-teal-500 px-5 py-3 text-xs font-black text-white shadow-lg shadow-teal-500/10 transition hover:bg-teal-400 sm:w-auto"
                >
                  Explore Details
                </button>
              </div>
            </div>

            {/* Slide Indicators */}
            {spotlightSpots.length > 1 && (
              <div className="absolute bottom-4 left-6 sm:left-8 md:left-12 flex items-center gap-1.5 z-20">
                {spotlightSpots.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSpotlightIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${spotlightIndex === idx ? "w-6 bg-teal-500" : "w-1.5 bg-[var(--border)] hover:bg-[var(--muted)]"
                      }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}


        <div className="app-surface rounded-lg p-3 md:p-4">
          <CitySwitcher
            value={activeCity}
            onChange={(city) => {
              chooseCity(city);
              setQuery("");
              setActiveCategory("all");
            }}
          />
          <LocationPermissionCard
            source={locationSource}
            loading={locationLoading}
            error={locationError}
            onRequest={() => {
              preferDetectedCity();
              requestLocation();
            }}
          />

          {/* Weather Widget */}
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--panel)] to-[var(--panel-soft)] p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                {weather.condition === "Rainy" && <CloudRain size={20} className="animate-bounce text-cyan-400" />}
                {weather.condition === "Hot" && <Sun size={20} className="animate-spin text-amber-400" style={{ animationDuration: "12s" }} />}
                {weather.condition === "Cozy" && <ThermometerSnowflake size={20} className="animate-pulse text-sky-400" />}
                {weather.condition === "Pleasant" && <Cloud size={20} className="animate-pulse text-teal-300" />}
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-400">Current weather in {activeCity}</span>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <h4 className="text-sm font-black text-[var(--foreground)] leading-none">
                    {weather.label} · {weather.temp}°C
                  </h4>
                  <span className="text-[10px] text-[var(--muted)] font-bold">
                    (💧 {weather.humidity}% humidity · 💨 {weather.windSpeed} km/h wind)
                  </span>
                </div>
                <p className="text-xs font-semibold text-[var(--muted-strong)] mt-1.5 leading-relaxed">
                  {weather.poeticNote}
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/trips"
            className="mt-3 flex items-center justify-between rounded-xl border border-teal-500/25 bg-gradient-to-r from-teal-500/5 via-cyan-500/5 to-transparent px-4 py-3 sm:px-5 sm:py-4 transition-all duration-300 hover:-translate-y-1 hover:border-teal-400/50 hover:from-teal-500/10 hover:to-cyan-500/10 hover:shadow-[0_8px_30px_rgba(20,184,166,0.12)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                <Sparkles size={18} className="animate-pulse" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-black text-[var(--foreground)]">Twin-City Route Planner 🔀</p>
                <p className="text-[10px] sm:text-xs font-semibold text-[var(--muted)] truncate">Create custom itineraries for Hubli-Dharwad, Pune-PCMC, Bangalore-Mysore...</p>
              </div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-teal-400" />
          </Link>

          <MoodPicker value={selectedMood} onChange={setSelectedMood} className="mt-3" />

          {/* Search controls — mobile 2-row, desktop single-row */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {/* Search bar */}
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={19} />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search cafes, food, events in ${activeCity}`}
                className="h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] pl-11 pr-3 text-sm font-semibold text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-teal-300"
              />
            </label>

            {/* Controls — row on mobile too, but smaller */}
            <div className="no-scrollbar flex w-full sm:w-auto shrink-0 items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 sm:overflow-visible sm:pb-0">
              {/* Sort Dropdown */}
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-10 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-xs font-bold text-[var(--foreground)] outline-none transition focus:border-teal-300 sm:h-12 sm:w-auto sm:px-3 sm:text-sm"
                aria-label="Sort places"
              >
                <option value="recommended">Recommended</option>
                <option value="distance">Nearest</option>
                <option value="rating">Top rated</option>
              </select>

              {/* Pure Veg Button */}
              <button
                type="button"
                onClick={() => setVegOnly((current) => !current)}
                className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition whitespace-nowrap sm:h-12 sm:gap-2 sm:px-4 sm:text-sm border ${
                  vegOnly
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-black"
                    : "border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${vegOnly ? "bg-emerald-400 border-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-slate-500 border-slate-600"}`} />
                <span>Pure Veg</span>
              </button>

              {/* Open Now Button */}
              <button
                type="button"
                onClick={() => setOpenOnly((current) => !current)}
                className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition whitespace-nowrap sm:h-12 sm:gap-2 sm:px-4 sm:text-sm ${openOnly
                    ? "bg-emerald-300 text-slate-950"
                    : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
                  }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full hidden sm:block ${openOnly ? "bg-slate-950 animate-pulse" : "bg-slate-500"}`} />
                <span className="sm:hidden"><LocateFixed size={15} /></span>
                <span className="hidden sm:inline">Open now</span>
                <span className="sm:hidden">Open</span>
              </button>

              {/* Advanced Filters Button */}
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition whitespace-nowrap sm:h-12 sm:gap-2 sm:px-4 sm:text-sm ${showAdvancedFilters || selectedRating > 0 || selectedPrice !== "all" || selectedTags.size > 0
                    ? "bg-teal-400 text-slate-950"
                    : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
                  }`}
              >
                <SlidersHorizontal size={15} className="sm:hidden" />
                <SlidersHorizontal size={17} className="hidden sm:block" />
                Filters
                {(selectedRating > 0 || selectedPrice !== "all" || selectedTags.size > 0) && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-[9px] font-black text-white sm:h-5 sm:w-5 sm:text-[10px]">
                    {(selectedRating > 0 ? 1 : 0) + (selectedPrice !== "all" ? 1 : 0) + selectedTags.size}
                  </span>
                )}
              </button>

              {/* Swipe & Vibe Button */}
              <button
                type="button"
                onClick={() => setSwipeMode(true)}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition whitespace-nowrap sm:h-12 sm:gap-2 sm:px-4 sm:text-sm bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-lg shadow-teal-500/20 hover:from-teal-400 hover:to-emerald-400 active:scale-95"
              >
                <Zap size={14} strokeWidth={2.5} className="sm:hidden" />
                <Zap size={16} strokeWidth={2.5} className="hidden sm:block" />
                <span className="hidden sm:inline">Swipe Mode</span>
                <span className="sm:hidden">Vibe</span>
              </button>
            </div>
          </div>

          {/* Advanced Filters panel overlay */}
          <AnimatePresence>
            {showAdvancedFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-t border-[var(--border)] mt-4 pt-4 grid gap-4 md:grid-cols-3 text-xs sm:text-sm font-semibold"
              >
                {/* Rating Filter */}
                <div className="space-y-2">
                  <span className="block text-xs font-black uppercase text-slate-400">Minimum Rating</span>
                  <div className="flex gap-2">
                    {([0, 4.0, 4.5] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSelectedRating(r)}
                        className={`flex-1 py-2 text-center rounded-lg font-bold border transition ${selectedRating === r
                            ? "bg-teal-400/10 border-teal-400/40 text-teal-300 font-black"
                            : "border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900"
                          }`}
                      >
                        {r === 0 ? "Any" : `${r}★+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Filter */}
                <div className="space-y-2">
                  <span className="block text-xs font-black uppercase text-slate-400">Price Range</span>
                  <div className="flex gap-2">
                    {(["all", "$", "$$", "$$$"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPrice(p)}
                        className={`flex-1 py-2 text-center rounded-lg font-bold border transition uppercase ${selectedPrice === p
                            ? "bg-teal-400/10 border-teal-400/40 text-teal-300 font-black"
                            : "border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900"
                          }`}
                      >
                        {p === "all" ? "Any" : p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags Filter */}
                <div className="space-y-2">
                  <span className="block text-xs font-black uppercase text-slate-400">Amenities & Vibes</span>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { id: "pet-friendly", label: "🐾 Pet Friendly" },
                      { id: "family-friendly", label: "👨‍👩‍👧 Family Friendly" },
                      { id: "work-friendly", label: "💻 Work Friendly" },
                      { id: "heritage", label: "🏛️ Heritage/Cultural" },
                      { id: "scenic", label: "🌅 Scenic Views" },
                    ] as const).map((tag) => {
                      const active = selectedTags.has(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTagFilter(tag.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${active
                              ? "bg-teal-400/10 border-teal-400/40 text-teal-300 font-black"
                              : "border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900"
                            }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Tag Badges */}
          <div className="no-scrollbar scroll-fade-right mt-3 flex gap-2 overflow-x-auto pb-1">
            {([
              { id: "pet-friendly", label: "🐾 Pet Friendly" },
              { id: "family-friendly", label: "👨‍👩‍👧 Family Friendly" },
              { id: "work-friendly", label: "💻 Work Friendly" },
              { id: "heritage", label: "🏛️ Heritage & Culture" },
              { id: "scenic", label: "🌅 Scenic Views" },
              { id: "live-music", label: "🎵 Live Music" },
              { id: "artisanal", label: "✨ Artisanal" },
              { id: "late-night", label: "🌙 Late Night" },
            ] as const).map((tag) => {
              const active = selectedTags.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTagFilter(tag.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition border cursor-pointer ${
                    active
                      ? "bg-teal-400/20 border-teal-400/50 text-teal-300 font-black shadow-sm"
                      : "border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>

          <div className="no-scrollbar scroll-fade-right mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => {
              const active = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition sm:px-4 sm:text-sm ${active
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] hover:bg-[var(--panel)]"
                    }`}
                >
                  {category.icon}
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        {livePlacesError && (
          <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100">
            Showing curated {activeCity} backup places while live OpenStreetMap is unavailable. {livePlacesError}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 md:mt-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5">
              <Compass size={15} className="text-teal-300" />
              {livePlacesLoading
                ? "Loading live nearby places"
                : hasFilters
                  ? `${totalFilteredCount} matching places`
                  : `${allPlaces.length} ${usingLivePlaces ? "live + curated" : "curated"} ${activeCity} places`}
            </span>
            {selectedMood && (
              <span className="rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1.5 font-semibold text-teal-100">
                Mood: {getMoodLabel(selectedMood)}
              </span>
            )}
            {activeCategory !== "all" && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5">
                {activeCategory === "free" ? "Free 2-3 hrs" : activeCategory === "night-drive" ? "Night Drives" : getCategoryLabel(activeCategory as PlaceCategory)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowMap((current) => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2.5 text-sm font-black text-[var(--foreground)] transition hover:bg-[var(--panel)]"
          >
            <MapPin size={17} />
            {showMap ? "Hide Map" : "Show Map"}
          </button>
        </div>

        {showMap && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-5"
          >
            <MapView
              places={hasFilters ? filteredPlaces : allPlaces}
              userLocation={distanceReference}
              selectedPlace={selectedPlace}
              onMarkerClick={setSelectedPlace}
              className="h-[320px] min-h-[320px] rounded-lg sm:h-[420px] sm:min-h-[420px]"
            />
          </motion.div>
        )}

        <div className="py-4">
          {hasFilters ? (
            <>
              {filteredPlaces.length > 0 ? (
                <>
                  <DiscoverySection
                    title="Filtered Results"
                    description="Your current search and filters, sorted the way you chose."
                    places={filteredPlaces}
                    loading={livePlacesLoading}
                    onPlaceClick={setSelectedPlace}
                    onSavePlace={toggleSave}
                    savedPlaceIds={savedPlaceIds}
                    vibeScores={vibeScores}
                  />
                  {hasMore && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={handleLoadMore}
                        className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-6 py-3 text-sm font-bold hover:bg-[var(--panel)]"
                      >
                        Load More
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="relative mt-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--panel-strong)] via-[var(--panel)] to-[var(--panel-soft)] p-6 sm:p-10 text-center shadow-2xl"
                >
                  {/* Decorative background blurs */}
                  <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-rose-500/8 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-teal-500/8 blur-3xl" />

                  <div className="relative z-10 mx-auto max-w-md space-y-4">
                    {/* Animated search icon */}
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.15 }}
                      className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] shadow-lg"
                    >
                      <Search size={28} className="text-[var(--muted)] opacity-50" />
                    </motion.div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-black text-[var(--foreground)] sm:text-xl">
                        No places found
                        {query.trim() && (
                          <span className="block mt-1 text-sm font-bold text-[var(--muted)]">
                            for &ldquo;<span className="text-teal-400">{query.trim()}</span>&rdquo;
                          </span>
                        )}
                      </h3>
                      <p className="text-sm leading-relaxed text-[var(--muted)]">
                        We couldn&apos;t find any matching places in <span className="font-bold text-[var(--muted-strong)]">{activeCity}</span>. Try adjusting your search or filters.
                      </p>
                    </div>

                    {/* Helpful tips */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)]/60 p-4 text-left">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">💡 Suggestions</p>
                      <ul className="space-y-1.5 text-xs font-semibold text-[var(--muted-strong)]">
                        <li className="flex items-start gap-2"><span className="shrink-0 text-teal-400">•</span> Try broader terms like &ldquo;cafe&rdquo;, &ldquo;restaurant&rdquo;, or &ldquo;street food&rdquo;</li>
                        <li className="flex items-start gap-2"><span className="shrink-0 text-teal-400">•</span> Check the spelling of the place name</li>
                        <li className="flex items-start gap-2"><span className="shrink-0 text-teal-400">•</span> Remove filters like Open Now, Veg Only, or price range</li>
                        <li className="flex items-start gap-2"><span className="shrink-0 text-teal-400">•</span> Search by area name like &ldquo;Koregaon Park&rdquo; or &ldquo;FC Road&rdquo;</li>
                      </ul>
                    </div>

                    {/* Quick actions */}
                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setActiveCategory("all");
                          setOpenOnly(false);
                          setVegOnly(false);
                          setSelectedRating(0);
                          setSelectedPrice("all");
                          setSelectedTags(new Set());
                          setSortMode("recommended");
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-teal-500/15 transition hover:bg-teal-400 active:scale-95"
                      >
                        <X size={14} />
                        Clear All Filters
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-5 py-2.5 text-xs font-black text-[var(--foreground)] transition hover:bg-[var(--panel)]"
                      >
                        <Search size={14} />
                        Clear Search
                      </button>
                    </div>

                    {/* Quick category browse */}
                    <div className="pt-2">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Browse by category</p>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setQuery("");
                              setActiveCategory(cat.id);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-bold text-[var(--muted-strong)] transition hover:border-teal-400/40 hover:bg-teal-500/10 hover:text-teal-300"
                          >
                            {cat.icon}
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          ) : (
            <>
              {activeAirportCode && AIRPORT_GUIDES[activeAirportCode] && (
                <div className="mb-6 rounded-xl border border-amber-500/20 bg-gradient-to-r from-slate-950 to-[#0b1c24] p-4 relative overflow-hidden backdrop-blur-sm shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
                        <Plane size={18} className="rotate-45 text-amber-400" />
                      </div>
                      <div className="text-left">
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">Airport layover guide</span>
                        <h4 className="text-sm font-black text-white leading-tight mt-0.5">
                          Terminal Companion: {AIRPORT_GUIDES[activeAirportCode].name}
                        </h4>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">
                          View time-budgeted spots and claim VIP Lounge coupons.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAirportCode(activeAirportCode);
                        setIsAirportGuideOpen(true);
                      }}
                      className="shrink-0 rounded-lg bg-amber-400 hover:bg-amber-350 px-4 py-2 text-xs font-black text-slate-950 transition active:scale-95 cursor-pointer shadow"
                    >
                      Explore {activeAirportCode} Guide
                    </button>
                  </div>
                </div>
              )}
              {defaultSections.map((section) => (
                <DiscoverySection
                  key={section.title}
                  title={section.title}
                  description={section.description}
                  places={section.places}
                  loading={livePlacesLoading && !usingLivePlaces}
                  onPlaceClick={setSelectedPlace}
                  onSavePlace={toggleSave}
                  savedPlaceIds={savedPlaceIds}
                  carousel={true}
                  vibeScores={vibeScores}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Airport layover companion guide modal */}
      <AnimatePresence>
        {isAirportGuideOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[900] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
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
                        "flex flex-col items-center justify-center py-2 px-0.5 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer text-center select-none",
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
      </AnimatePresence>

      <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />

      {/* ── Swipe & Vibe Mode ─────────────────────────────────────────── */}
      <AnimatePresence>
        {swipeMode && (
          <SwipeVibeMode
            places={allPlaces}
            onOpenPlace={(place) => {
              setSelectedPlace(place);
            }}
            onClose={() => setSwipeMode(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
