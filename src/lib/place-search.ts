import { Place, PlaceCategory } from "@/types";
import { getMoodMatchScore, inferMoodProfile, MoodAxis } from "@/lib/mood-recommendations";
import { getCategoryLabel, isOpenNow } from "@/lib/utils";

const categoryTerms: Record<PlaceCategory, string[]> = {
  cafe: ["cafe", "coffee", "chai", "brunch", "breakfast", "work", "wifi", "cozy"],
  restaurant: ["restaurant", "food", "dinner", "lunch", "family", "meal", "veg", "non veg"],
  event: ["event", "things to do", "walk", "heritage", "museum", "temple", "garden", "park", "tourist"],
  nightlife: ["nightlife", "club", "party", "dance", "late night", "music"],
  "food-stall": ["food stall", "snack", "quick bite", "chaat", "street"],
  bar: ["bar", "pub", "drinks", "cocktail", "date", "rooftop", "late night"],
  dessert: ["dessert", "sweet", "ice cream", "bakery", "cake"],
  "street-food": ["street food", "misal", "vada pav", "chaat", "snack", "quick bite"],
};

const vibeTerms: Record<string, string[]> = {
  cozy: ["cafe", "coffee", "brunch", "bakery", "quiet", "work-friendly"],
  romantic: ["date", "dinner", "bar", "rooftop", "cocktail"],
  date: ["date", "romantic", "dinner", "bar", "rooftop", "cocktail"],
  family: ["family", "restaurant", "garden", "park", "meal"],
  cheap: ["$", "budget", "street-food", "food-stall", "snack"],
  budget: ["$", "cheap", "street-food", "food-stall", "snack"],
  breakfast: ["breakfast", "cafe", "south-indian", "chai", "bun-maska"],
  brunch: ["brunch", "cafe", "coffee", "bakery"],
  "late night": ["late night", "bar", "pub", "nightlife", "club"],
  rooftop: ["rooftop", "bar", "pub", "date", "drinks"],
  wifi: ["wifi", "work", "cafe", "coffee"],
  work: ["wifi", "work", "cafe", "coffee", "quiet"],
  outdoor: ["outdoor", "garden", "park", "walk"],
  heritage: ["heritage", "walk", "museum", "temple", "tourist"],
  spicy: ["spicy", "misal", "street-food", "chaat"],
};

const normalize = (value: string) => value.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

export const inferCategoryFromQuery = (query: string): PlaceCategory | null => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  for (const [category, terms] of Object.entries(categoryTerms) as [PlaceCategory, string[]][]) {
    if (terms.some((term) => normalizedQuery.includes(term))) return category;
  }

  return null;
};

const getSearchText = (place: Place) => {
  const categoryLabel = getCategoryLabel(place.category);
  const categoryVibes = categoryTerms[place.category] ?? [];

  return normalize(
    [
      place.title,
      place.locality,
      place.city,
      place.category,
      categoryLabel,
      place.description,
      place.priceRange,
      ...place.tags,
      ...categoryVibes,
    ].join(" ")
  );
};

const expandQueryTerms = (query: string) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const directTerms = normalizedQuery.split(" ").filter(Boolean);
  const expandedTerms = Object.entries(vibeTerms).flatMap(([vibe, terms]) =>
    normalizedQuery.includes(vibe) ? terms : []
  );

  return Array.from(new Set([normalizedQuery, ...directTerms, ...expandedTerms].map(normalize).filter(Boolean)));
};

export const getPlaceSearchScore = (place: Place, query: string) => {
  const terms = expandQueryTerms(query);
  if (!terms.length) return 0;

  const text = getSearchText(place);
  const title = normalize(place.title);
  const locality = normalize(place.locality);
  const category = normalize(getCategoryLabel(place.category));

  return terms.reduce((score, term) => {
    if (title.includes(term)) return score + 12;
    if (locality.includes(term)) return score + 8;
    if (category.includes(term) || place.category.includes(term as PlaceCategory)) return score + 7;
    if (text.includes(term)) return score + 4;
    return score;
  }, 0);
};

export const filterAndRankPlaces = (
  places: Place[],
  options: {
    query: string;
    category?: PlaceCategory | "all" | "free" | "trending" | "open" | "night-drive" | null;
    openOnly?: boolean;
    now?: Date;
    /** When true, blends mood vector scores into recommended ordering (no UI required). */
    useMoodRanking?: boolean;
    explicitMood?: MoodAxis | null;
  }
) => {
  const trimmedQuery = options.query.trim();
  const inferredCategory = inferCategoryFromQuery(trimmedQuery);
  const effectiveCategory = options.category && options.category !== "all" ? options.category : inferredCategory;
  const now = options.now ?? new Date();
  const useMood = options.explicitMood != null || options.useMoodRanking === true;
  const moodProfile = useMood
    ? inferMoodProfile({ query: trimmedQuery, now, explicitMood: options.explicitMood })
    : null;
  const moodWeight = options.explicitMood ? 12 : 5;

  return places
    .map((place) => {
      const searchScore = getPlaceSearchScore(place, trimmedQuery);
      const moodScore = moodProfile ? getMoodMatchScore(place, moodProfile, now) : 0;
      const combinedScore = searchScore + moodScore * moodWeight;

      return { place, score: searchScore, combinedScore };
    })
    .filter(({ place, score }) => {
      const matchesQuery = !trimmedQuery || score > 0;
      const matchesCategory =
        !effectiveCategory ||
        (effectiveCategory === "trending" && place.isTrending) ||
        (effectiveCategory === "open" && Boolean(place.hours) && isOpenNow(place.hours, now)) ||
        (effectiveCategory === "free" && place.tags.includes("free") && place.tags.includes("tourist-friendly")) ||
        (effectiveCategory === "night-drive" && place.tags.includes("night-drive")) ||
        place.category === effectiveCategory;
      const matchesOpen = !options.openOnly || (Boolean(place.hours) && isOpenNow(place.hours, now));

      return matchesQuery && matchesCategory && matchesOpen;
    })
    .sort((a, b) => {
      if (trimmedQuery && a.score !== b.score) return b.score - a.score;
      if (a.combinedScore !== b.combinedScore) return b.combinedScore - a.combinedScore;
      if (a.place.isTrending !== b.place.isTrending) return Number(b.place.isTrending) - Number(a.place.isTrending);
      return a.place.distance - b.place.distance;
    })
    .map(({ place }) => place);
};
