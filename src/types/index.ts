export type PlaceCategory = "cafe" | "restaurant" | "event" | "nightlife" | "food-stall" | "bar" | "dessert" | "ice-cream" | "street-food";
export type { SupportedCityName } from '@/lib/pune-location';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface TrailStop {
  title: string;
  description: string;
  locality: string;
  image?: string;
}

export interface Place extends Location {
  id: string;
  title: string;
  description: string;
  category: PlaceCategory;
  image: string;
  rating: number;
  distance: number;
  tags: string[];
  city: string;
  locality: string;
  isOpen: boolean;
  isTrending: boolean;
  reviewCount: number;
  priceRange?: string;
  phone?: string;
  website?: string;
  influencerFeatures?: InfluencerFeature[];
  hours?: {
    open: string;
    close: string;
  };
  routeWaypoints?: Location[];
  trailStops?: TrailStop[];
  isVeg?: boolean;
  reviewMood?: Record<string, number>;
}

export interface InfluencerFeature {
  creatorName: string;
  handle: string;
  rating: number;
  platform: "instagram" | "youtube";
  videoUrl: string;
  quote: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface DiscoverSection {
  title: string;
  description?: string;
  places: Place[];
}

export type UserRole = "user" | "super_admin";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  isPremiumPass?: boolean;
}

export type CrowdLevel = "low" | "moderate" | "busy" | "very_crowded";

export interface CrowdReport {
  id: string;
  placeId: string;
  crowdLevel: CrowdLevel;
  note?: string;
  reportedAt: string;
}

export interface CrowdSummary {
  placeId: string;
  crowdLevel: CrowdLevel | null;
  reportCount: number;
  averageScore: number | null;
  latestReportedAt: string | null;
}
