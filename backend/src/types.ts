/**
 * Shared types for Sheher backend
 * Copied from shared/types.ts so the backend can build standalone on Railway
 */

export interface Place {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  category:
    | "cafe"
    | "restaurant"
    | "bar"
    | "event"
    | "nightlife"
    | "food-street"
    | "hidden-gem"
    | "cultural"
    | "community"
    | "niche";
  image: string;
  images?: string[];
  rating: number;
  distance: number;
  latitude: number;
  longitude: number;
  tags: string[];
  city: string;
  locality: string;
  isOpen: boolean;
  isTrending: boolean;
  isHiddenGem?: boolean;
  happeningTonight?: boolean;
  reviewCount: number;
  priceRange: "$" | "$$" | "$$$" | "$$$$";
  hours: { open: string; close: string };
  vibeDescription?: string;
  instagramHandle?: string;
  niche?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DiscoverySection {
  id: string;
  title: string;
  description?: string;
  places: Place[];
  icon?: string;
  color?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}
