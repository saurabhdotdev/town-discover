import { PlaceCategory } from "@/types";

// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes
    .filter((item) => typeof item === "string")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

export const formatDistance = (distance: number): string => {
  if (distance < 0.1) return "Right here";
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

export const isOpenNow = (hours: { open: string; close: string } | undefined): boolean => {
  if (!hours) return true;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
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

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const getCategoryLabel = (category: PlaceCategory): string => {
  const labels: Record<PlaceCategory, string> = {
    cafe: "Cafe",
    restaurant: "Restaurant",
    event: "Event",
    nightlife: "Nightlife",
    "food-stall": "Food Stall",
    bar: "Bar",
    dessert: "Dessert",
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
    "street-food": "from-orange-300 to-red-500",
  };

  return colors[category];
};
