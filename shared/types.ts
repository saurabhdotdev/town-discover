/**
 * Shared types used across Sheher frontend and backend
 */

// Place/Discovery Types
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

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  bio?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Location Types
export interface GeolocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface MapBounds {
  northEast: { lat: number; lng: number };
  southWest: { lat: number; lng: number };
}

export interface MapViewState {
  center: { lat: number; lng: number };
  zoom: number;
}

// Comment/Vibe Types
export interface PlaceComment {
  id: string;
  placeId: string;
  userId: string;
  text: string;
  vibe: "great" | "good" | "ok" | "avoid"; // Simple vibe rating
  createdAt: Date;
}

// Search/Filter Types
export interface SearchFilters {
  category?: string[];
  priceRange?: ("$" | "$$" | "$$$" | "$$$$")[];
  radius?: number; // in km
  isOpen?: boolean;
  rating?: number; // minimum rating
  search?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}
