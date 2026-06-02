import { PlaceCategory } from "@/types";

// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes
    .filter((item) => typeof item === "string")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

export const formatDistance = (distance: number): string => {
  if (distance < 0.001) return "<1 m";
  if (distance < 0.05) return "Right here";
  if (distance < 0.1) return `${Math.round(distance * 1000)} m`;
  return `${Math.round(distance * 10) / 10} km`;
};

export const formatTime = (time24: string): string => {
  const [hours = "0", minutes = "00"] = time24.split(":");
  const hour = Number.parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${period}`;
};

const toMinutes = (time24: string): number => {
  const [hours = "0", minutes = "0"] = time24.split(":");
  return Number.parseInt(hours, 10) * 60 + Number.parseInt(minutes, 10);
};

export const isOpenNow = (hours: { open: string; close: string } | undefined, at = new Date()): boolean => {
  if (!hours) return false;

  const current = at.getHours() * 60 + at.getMinutes();
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);

  if (open === close) return true;
  if (open < close) return current >= open && current <= close;
  return current >= open || current <= close;
};

export const formatHours = (hours: { open: string; close: string } | undefined): string => {
  if (!hours) return "Hours unavailable";
  return `${formatTime(hours.open)} - ${formatTime(hours.close)}`;
};

type PlaceAreaLike = {
  locality?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const weakAreaLabels = new Set([
  "",
  "nearby",
  "unknown",
  "area unknown",
  "location unknown",
  "current location",
  "central",
  "city center",
  "city centre",
  "downtown",
  "main road",
  "market area",
  "near me",
]);

const areaAliases: Record<string, string> = {
  "fc road": "Fergusson College Road",
  "f.c. road": "Fergusson College Road",
  "f c road": "Fergusson College Road",
  "jm road": "Jangli Maharaj Road",
  "j.m. road": "Jangli Maharaj Road",
  "j m road": "Jangli Maharaj Road",
  "sb road": "Senapati Bapat Road",
  "s.b. road": "Senapati Bapat Road",
  "s b road": "Senapati Bapat Road",
  kp: "Koregaon Park",
  hkv: "Hauz Khas Village",
  cp: "Connaught Place",
  ecr: "East Coast Road",
  "indira nagar": "Indiranagar",
  kalyaninagar: "Kalyani Nagar",
  "cyber city": "DLF Cyber City",
  "navi-mumbai": "Navi Mumbai",
};

const cleanLocationPart = (value?: string | null): string => {
  const cleaned =
    value
      ?.replace(/[|]+/g, ",")
      .replace(/\b(undefined|null|nan)\b/gi, "")
      .replace(/\s+/g, " ")
      .replace(/\s+,/g, ",")
      .replace(/,\s*,+/g, ",")
      .replace(/^near\s+/i, "")
      .replace(/^area:\s*/i, "")
      .replace(/^locality:\s*/i, "")
      .replace(/^address:\s*/i, "")
      .replace(/^km\s*milestone\s*\d+/i, "")
      .trim()
      .replace(/^,+|,+$/g, "")
      .trim() ?? "";

  return areaAliases[cleaned.toLowerCase()] ?? cleaned;
};

export const isUsefulArea = (value?: string | null): boolean => {
  const cleaned = cleanLocationPart(value);
  if (!cleaned) return false;
  const normalized = cleaned.toLowerCase();
  if (weakAreaLabels.has(normalized)) return false;
  if (/^km\s*\d+$/i.test(normalized)) return false;
  if (/^\d+(\.\d+)?\s*,\s*\d+(\.\d+)?$/.test(normalized)) return false;
  return true;
};

export const formatPlaceArea = (place: PlaceAreaLike): string => {
  const locality = cleanLocationPart(place.locality);
  const city = cleanLocationPart(place.city);
  const parts: string[] = [];

  if (isUsefulArea(locality)) {
    parts.push(locality);
  }

  if (isUsefulArea(city) && city.toLowerCase() !== locality.toLowerCase()) {
    parts.push(city);
  }

  if (parts.length > 0) {
    return parts.join(", ");
  }

  if (typeof place.latitude === "number" && typeof place.longitude === "number") {
    return `Near ${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`;
  }

  return "Area details pending";
};

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const getCategoryLabel = (category: PlaceCategory, tags?: string[]): string => {
  if (tags?.includes("ev-station")) {
    return "EV Charging";
  }
  if (tags?.includes("toilet") || tags?.includes("restroom")) {
    return "Restroom";
  }
  if (tags?.includes("viewpoint") || tags?.includes("scenic")) {
    return "Scenic Stop";
  }
  if (tags?.includes("hotel") || tags?.includes("stay")) {
    return "Hotel/Stay";
  }
  if (tags?.includes("night-drive")) {
    return "Night Drive";
  }

  const labels: Record<PlaceCategory, string> = {
    cafe: "Cafe",
    restaurant: "Restaurant",
    event: "Event",
    nightlife: "Nightlife",
    "food-stall": "Food Stall",
    bar: "Bar",
    dessert: "Dessert",
    "ice-cream": "Ice Cream",
    "street-food": "Street Food",
  };

  return labels[category];
};

export const getCategoryAccent = (category: PlaceCategory): string => {
  const colors: Record<PlaceCategory, string> = {
    cafe: "from-amber-300 to-orange-500",
    restaurant: "from-rose-400 to-red-500",
    event: "from-cyan-300 to-blue-500",
    nightlife: "from-fuchsia-400 to-rose-500",
    "food-stall": "from-yellow-300 to-orange-500",
    bar: "from-pink-400 to-red-600",
    dessert: "from-teal-300 to-emerald-500",
    "ice-cream": "from-pink-300 to-fuchsia-500",
    "street-food": "from-orange-300 to-red-500",
  };

  return colors[category];
};
