import { Place, PlaceCategory } from "@/types";
import { isOpenNow } from "@/lib/utils";

/** Mood axes used for lightweight vector scoring (no external ML service). */
export type MoodAxis =
  | "chill"
  | "adventurous"
  | "social"
  | "foodie"
  | "romantic"
  | "cultural"
  | "energetic"
  | "budget";

export type MoodProfile = Record<MoodAxis, number>;

export const MOOD_OPTIONS: {
  id: MoodAxis;
  label: string;
  hint: string;
  emoji: string;
}[] = [
  { id: "chill", label: "Chill", hint: "Calm cafes, gardens, slow walks", emoji: "🌿" },
  { id: "foodie", label: "Foodie", hint: "Best bites, snacks, and meals", emoji: "🍜" },
  { id: "romantic", label: "Date night", hint: "Rooftops, dinner, cozy spots", emoji: "✨" },
  { id: "social", label: "Social", hint: "Bars, meetups, lively places", emoji: "🎉" },
  { id: "cultural", label: "Culture", hint: "Heritage, temples, museums", emoji: "🏛️" },
  { id: "adventurous", label: "Explore", hint: "Trails, walks, new experiences", emoji: "🥾" },
  { id: "energetic", label: "High energy", hint: "Nightlife, live events, parties", emoji: "⚡" },
  { id: "budget", label: "Budget", hint: "Free plans and cheap eats", emoji: "💸" },
];

export const getMoodLabel = (mood: MoodAxis) =>
  MOOD_OPTIONS.find((option) => option.id === mood)?.label ?? mood;

const MOOD_AXES: MoodAxis[] = [
  "chill",
  "adventurous",
  "social",
  "foodie",
  "romantic",
  "cultural",
  "energetic",
  "budget",
];

const normalize = (value: string) => value.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

const QUERY_MOOD_HINTS: Record<string, Partial<MoodProfile>> = {
  cozy: { chill: 0.9, romantic: 0.3 },
  chill: { chill: 1 },
  relaxed: { chill: 0.85, cultural: 0.2 },
  calm: { chill: 0.8, cultural: 0.25 },
  romantic: { romantic: 1, chill: 0.35 },
  date: { romantic: 0.95, social: 0.4 },
  party: { energetic: 1, social: 0.85 },
  nightlife: { energetic: 0.9, social: 0.8 },
  "late night": { energetic: 0.85, social: 0.7 },
  adventure: { adventurous: 1, energetic: 0.5 },
  walk: { adventurous: 0.6, cultural: 0.5 },
  heritage: { cultural: 1, adventurous: 0.35 },
  museum: { cultural: 0.95, chill: 0.3 },
  temple: { cultural: 0.85, chill: 0.25 },
  family: { social: 0.7, chill: 0.4, budget: 0.35 },
  cheap: { budget: 1 },
  budget: { budget: 1 },
  free: { budget: 0.95, cultural: 0.35 },
  food: { foodie: 1 },
  coffee: { chill: 0.55, foodie: 0.65 },
  brunch: { chill: 0.5, foodie: 0.7 },
  spicy: { foodie: 0.75, adventurous: 0.35 },
  work: { chill: 0.7, foodie: 0.35 },
  wifi: { chill: 0.75 },
  outdoor: { adventurous: 0.65, chill: 0.4 },
  sunset: { romantic: 0.55, chill: 0.45 },
  bored: { adventurous: 0.7, social: 0.55, energetic: 0.45 },
  tired: { chill: 0.85, foodie: 0.35 },
  stressed: { chill: 0.9, cultural: 0.25 },
  happy: { social: 0.75, energetic: 0.55 },
  sad: { chill: 0.7, cultural: 0.4 },
};

const CATEGORY_MOOD: Record<PlaceCategory, Partial<MoodProfile>> = {
  cafe: { chill: 0.7, foodie: 0.55 },
  restaurant: { foodie: 0.85, social: 0.45 },
  event: { cultural: 0.75, adventurous: 0.55, chill: 0.35 },
  nightlife: { energetic: 0.95, social: 0.85 },
  "food-stall": { foodie: 0.8, budget: 0.65 },
  bar: { social: 0.8, romantic: 0.45, energetic: 0.55 },
  dessert: { chill: 0.5, foodie: 0.6, romantic: 0.35 },
  "ice-cream": { chill: 0.65, foodie: 0.75, romantic: 0.4, social: 0.35 },
  "street-food": { foodie: 0.85, budget: 0.7, adventurous: 0.35 },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const emptyProfile = (): MoodProfile =>
  Object.fromEntries(MOOD_AXES.map((axis) => [axis, 0])) as MoodProfile;

const blendProfiles = (base: MoodProfile, patch: Partial<MoodProfile>, weight = 1) => {
  const next = { ...base };
  for (const axis of MOOD_AXES) {
    const delta = patch[axis] ?? 0;
    if (delta > 0) next[axis] = clamp01(next[axis] + delta * weight);
  }
  return next;
};

const normalizeProfile = (profile: MoodProfile): MoodProfile => {
  const max = Math.max(...MOOD_AXES.map((axis) => profile[axis]), 0.001);
  return Object.fromEntries(MOOD_AXES.map((axis) => [axis, profile[axis] / max])) as MoodProfile;
};

const timeOfDayMood = (hour: number): Partial<MoodProfile> => {
  if (hour >= 5 && hour < 10) return { chill: 0.55, foodie: 0.65, adventurous: 0.25 };
  if (hour >= 10 && hour < 14) return { cultural: 0.45, foodie: 0.5, adventurous: 0.35 };
  if (hour >= 14 && hour < 17) return { chill: 0.45, cultural: 0.5 };
  if (hour >= 17 && hour < 20) return { romantic: 0.4, social: 0.45, cultural: 0.35 };
  if (hour >= 20 && hour < 23) return { social: 0.65, energetic: 0.55, romantic: 0.35 };
  return { energetic: 0.7, social: 0.6, romantic: 0.4 };
};

export const inferMoodFromQuery = (query: string): Partial<MoodProfile> => {
  const normalized = normalize(query);
  if (!normalized) return {};

  return Object.entries(QUERY_MOOD_HINTS).reduce<Partial<MoodProfile>>((profile, [hint, weights]) => {
    if (!normalized.includes(hint)) return profile;
    return MOOD_AXES.reduce<Partial<MoodProfile>>((merged, axis) => {
      merged[axis] = Math.max(merged[axis] ?? 0, weights[axis] ?? 0);
      return merged;
    }, { ...profile });
  }, {});
};

export const inferMoodProfile = (options: { query?: string; now?: Date; explicitMood?: MoodAxis | null }): MoodProfile => {
  const now = options.now ?? new Date();
  let profile = emptyProfile();
  profile = blendProfiles(profile, timeOfDayMood(now.getHours()), 0.55);
  profile = blendProfiles(profile, inferMoodFromQuery(options.query ?? ""), 1);

  if (options.explicitMood) {
    profile = blendProfiles(profile, { [options.explicitMood]: 1 }, 1.2);
  }

  const day = now.getDay();
  if (day === 0 || day === 6) {
    profile = blendProfiles(profile, { adventurous: 0.45, social: 0.4, energetic: 0.35 }, 0.35);
  }

  return normalizeProfile(profile);
};

const tagMoodBoost = (tags: string[]): Partial<MoodProfile> => {
  const joined = tags.join(" ").toLowerCase();
  const boost: Partial<MoodProfile> = {};

  if (joined.includes("free")) boost.budget = 0.9;
  if (joined.includes("heritage") || joined.includes("museum") || joined.includes("temple")) boost.cultural = 0.85;
  if (joined.includes("walk") || joined.includes("trail") || joined.includes("outdoor")) boost.adventurous = 0.7;
  if (joined.includes("sunset") || joined.includes("rooftop")) boost.romantic = 0.65;
  if (joined.includes("late-night") || joined.includes("club") || joined.includes("brewpub")) boost.energetic = 0.75;
  if (joined.includes("work") || joined.includes("wifi") || joined.includes("quiet")) boost.chill = 0.7;
  if (joined.includes("family") || joined.includes("tourist-friendly")) boost.social = 0.55;
  if (joined.includes("tonight") || joined.includes("live")) boost.energetic = 0.6;
  if (joined.includes("workshop") || joined.includes("meetup")) boost.social = 0.7;
  if (joined.includes("time-pass") || joined.includes("quick")) boost.chill = 0.5;

  return boost;
};

const priceMoodBoost = (priceRange?: string): Partial<MoodProfile> => {
  if (!priceRange) return {};
  if (priceRange === "$") return { budget: 0.9 };
  if (priceRange === "$$") return { budget: 0.45, foodie: 0.35 };
  if (priceRange === "$$$") return { romantic: 0.35, social: 0.4 };
  return { romantic: 0.45, social: 0.5, energetic: 0.35 };
};

export const extractPlaceMoodFeatures = (place: Place, now = new Date()): MoodProfile => {
  let profile = emptyProfile();
  profile = blendProfiles(profile, CATEGORY_MOOD[place.category] ?? {}, 0.85);
  profile = blendProfiles(profile, tagMoodBoost(place.tags), 0.9);
  profile = blendProfiles(profile, priceMoodBoost(place.priceRange), 0.5);

  if (place.isTrending) profile = blendProfiles(profile, { social: 0.45, energetic: 0.35 }, 0.4);
  if (place.rating >= 4.5) profile = blendProfiles(profile, { social: 0.25 }, 0.25);
  if (place.hours && isOpenNow(place.hours, now)) profile = blendProfiles(profile, { social: 0.2 }, 0.3);

  const text = normalize([place.title, place.description, ...place.tags].join(" "));
  profile = blendProfiles(profile, inferMoodFromQuery(text), 0.65);

  return normalizeProfile(profile);
};

const cosineSimilarity = (a: MoodProfile, b: MoodProfile) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const axis of MOOD_AXES) {
    dot += a[axis] * b[axis];
    normA += a[axis] * a[axis];
    normB += b[axis] * b[axis];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const getMoodMatchScore = (place: Place, mood: MoodProfile, now = new Date()) => {
  const placeFeatures = extractPlaceMoodFeatures(place, now);
  const similarity = cosineSimilarity(mood, placeFeatures);
  const openBoost = place.hours && isOpenNow(place.hours, now) ? 0.08 : 0;
  const distanceBoost = place.distance <= 2 ? 0.06 : place.distance <= 5 ? 0.03 : 0;
  const trendingBoost = place.isTrending ? 0.04 : 0;

  return similarity + openBoost + distanceBoost + trendingBoost;
};

export const rankPlacesByMood = (
  places: Place[],
  options: { query?: string; now?: Date; explicitMood?: MoodAxis | null }
) => {
  const mood = inferMoodProfile(options);
  const now = options.now ?? new Date();

  return [...places]
    .map((place) => ({
      place,
      moodScore: getMoodMatchScore(place, mood, now),
      dominantMood: MOOD_AXES.reduce((best, axis) => (mood[axis] > mood[best] ? axis : best), MOOD_AXES[0]),
    }))
    .sort((a, b) => b.moodScore - a.moodScore)
    .map(({ place, moodScore, dominantMood }) => ({ place, moodScore, dominantMood }));
};

export const getTopMoodRecommendations = (
  places: Place[],
  options: { query?: string; now?: Date; explicitMood?: MoodAxis | null; limit?: number }
) => {
  const limit = options.limit ?? 12;
  return rankPlacesByMood(places, options).slice(0, limit).map((entry) => entry.place);
};
