export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://town-discover.vercel.app";

export type MoodAxis =
  | "chill"
  | "adventurous"
  | "social"
  | "foodie"
  | "romantic"
  | "cultural"
  | "energetic"
  | "budget";

export type Place = {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  rating: number;
  distance: number;
  tags: string[];
  city: string;
  locality: string;
  latitude: number;
  longitude: number;
  isTrending?: boolean;
};

export interface PlaceReview {
  id: string;
  userFullName: string;
  rating: number;
  text: string;
}

export interface HangoutEntry {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  whatsappLink: string;
  placeTitle: string;
  userId: string;
  userFullName: string;
  createdAt: string;
  rsvps?: { userId: string }[];
}

export interface ShoutboxMessage {
  id: string;
  text: string;
  userFullName: string;
  createdAt: string;
  level?: number;
}

export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  rank: number;
  level: number;
  levelTitle: string;
  totalXp: number;
  badgeCount: number;
}

export interface GamificationStats {
  level: number;
  title: string;
  totalXp: number;
  xpForNext: number;
  progress: number;
  badges: { badge_id: string }[];
}

export interface SavedFolder {
  id: string;
  name: string;
  placeIds: string[];
}

export interface TripStop extends Place {
  isOpen?: boolean;
  isTrending?: boolean;
  reviewCount?: number;
  priceRange?: string;
}

export interface TripPlan {
  id: string;
  name: string;
  source: string;
  destination: string;
  distanceKm: number | null;
  durationMinutes: number | null;
  routePath: { latitude: number; longitude: number }[];
  stops: TripStop[];
}

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
  isPremiumPass?: boolean;
}

export async function fetchMoodRecommendations(options: {
  city: string;
  mood: MoodAxis;
  query?: string;
  lat?: number;
  lng?: number;
}) {
  const params = new URLSearchParams({
    query: [options.query, options.city].filter(Boolean).join(" "),
    mood: options.mood,
    limit: "15",
  });

  if (options.lat != null && options.lng != null) {
    params.set("lat", String(options.lat));
    params.set("lng", String(options.lng));
  }

  const response = await fetch(`${API_BASE_URL}/api/recommendations/mood?${params}`);
  if (!response.ok) throw new Error("Could not load mood recommendations");
  const data = await response.json();
  return data.recommendations as { place: Place; moodScore: number }[];
}

export async function fetchTownEvents(city: string) {
  const response = await fetch(`${API_BASE_URL}/api/events/town?city=${encodeURIComponent(city)}`);
  if (!response.ok) throw new Error("Could not load town events");
  const data = await response.json();
  return data.events as Place[];
}

export async function fetchPlaceReviews(placeId: string) {
  const response = await fetch(`${API_BASE_URL}/api/places/reviews?placeId=${encodeURIComponent(placeId)}`);
  if (!response.ok) throw new Error("Could not load reviews");
  const data = await response.json();
  return data.reviews as PlaceReview[];
}

export async function submitCrowdReport(placeId: string, level: string, note: string) {
  const response = await fetch(`${API_BASE_URL}/api/crowd-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, level, note }),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not submit crowd report");
  return response.json();
}

export async function fetchHangouts(city: string) {
  const response = await fetch(`${API_BASE_URL}/api/hangouts?city=${encodeURIComponent(city)}`);
  if (!response.ok) throw new Error("Could not load hangouts");
  const data = await response.json();
  return data.hangouts as HangoutEntry[];
}

export async function createHangout(data: {
  placeId: string;
  title: string;
  description: string;
  eventDate: string;
  whatsappLink: string;
  city: string;
}) {
  const response = await fetch(`${API_BASE_URL}/api/hangouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Could not create hangout");
  }
  return response.json();
}

export async function toggleRSVP(hangoutId: string) {
  const response = await fetch(`${API_BASE_URL}/api/hangouts/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hangoutId }),
    credentials: "include",
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Could not update RSVP");
  }
  return response.json();
}

export async function deleteHangout(hangoutId: string) {
  const response = await fetch(`${API_BASE_URL}/api/hangouts?id=${encodeURIComponent(hangoutId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not delete hangout");
  return response.json();
}

export async function fetchShoutboxMessages(city: string) {
  const response = await fetch(`${API_BASE_URL}/api/hangouts/shoutbox?city=${encodeURIComponent(city)}`);
  if (!response.ok) throw new Error("Could not load shoutbox messages");
  const data = await response.json();
  return data.messages as ShoutboxMessage[];
}

export async function postShoutboxMessage(text: string, city: string) {
  const response = await fetch(`${API_BASE_URL}/api/hangouts/shoutbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, city }),
    credentials: "include",
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Could not post shoutbox message");
  }
  return response.json();
}

export async function fetchOsmPlaces(city: string) {
  const response = await fetch(`${API_BASE_URL}/api/places/osm?city=${encodeURIComponent(city)}`);
  if (!response.ok) throw new Error("Could not load places");
  const data = await response.json();
  return data.places as Place[];
}

export async function fetchCurrentUser() {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    credentials: "include",
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.user as AuthUser | null;
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Login failed");
  return data;
}

export async function signupUser(email: string, password: string, fullName: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, fullName }),
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Registration failed");
  return data;
}

export async function logoutUser() {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Logout failed");
  return response.json().catch(() => ({}));
}

export async function fetchLeaderboard(city?: string) {
  const url = city && city !== "All Cities"
    ? `${API_BASE_URL}/api/leaderboard?city=${encodeURIComponent(city)}`
    : `${API_BASE_URL}/api/leaderboard`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load leaderboard");
  const data = await response.json();
  return data.leaderboard as LeaderboardEntry[];
}

export async function fetchGamificationStats() {
  const response = await fetch(`${API_BASE_URL}/api/gamification`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not load explorer statistics");
  const data = await response.json();
  return data.stats as GamificationStats;
}

export async function fetchSavedFolders() {
  const response = await fetch(`${API_BASE_URL}/api/saved-places/folders`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not load collections");
  const data = await response.json();
  return data.folders as SavedFolder[];
}

export async function createFolder(name: string) {
  const response = await fetch(`${API_BASE_URL}/api/saved-places/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not create collection");
  return data.folder as SavedFolder;
}

export async function deleteFolder(folderId: string) {
  const response = await fetch(`${API_BASE_URL}/api/saved-places/folders?id=${encodeURIComponent(folderId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not delete collection");
  return data;
}

export async function togglePlaceInFolder(placeId: string, folderId: string, isInFolder: boolean) {
  const url = isInFolder
    ? `${API_BASE_URL}/api/saved-places?placeId=${encodeURIComponent(placeId)}&folderId=${encodeURIComponent(folderId)}`
    : `${API_BASE_URL}/api/saved-places`;
  const response = await fetch(url, {
    method: isInFolder ? "DELETE" : "POST",
    headers: isInFolder ? undefined : { "Content-Type": "application/json" },
    body: isInFolder ? undefined : JSON.stringify({ placeId, folderId }),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not modify collection item");
  return response.json();
}

export async function fetchTripPlans() {
  const response = await fetch(`${API_BASE_URL}/api/trip-plans`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not load saved trip plans");
  const data = await response.json();
  return data.plans as TripPlan[];
}

export async function createTripPlan(payload: Omit<TripPlan, "id">) {
  const response = await fetch(`${API_BASE_URL}/api/trip-plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not save trip plan");
  return data.plan as TripPlan;
}

export async function fetchTripPlan(id: string) {
  const response = await fetch(`${API_BASE_URL}/api/trip-plans?id=${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error("Could not load trip plan");
  const data = await response.json();
  return data.plan as TripPlan;
}

export async function fetchPrivateDiscoveryBrief() {
  const response = await fetch(`${API_BASE_URL}/api/private-discovery`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not load private brief");
  return response.json();
}


