/** Point at your deployed site or local dev server. Website codebase stays separate. */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

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
};

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
