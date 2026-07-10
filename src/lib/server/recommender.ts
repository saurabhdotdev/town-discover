import { Pool } from "pg";
import { Place } from "@/types";
import { inferMoodProfile, getMoodMatchScore } from "@/lib/mood-recommendations";
import { MOCK_PLACES } from "@/data/mock-places";

export interface PersonalizedRecommendation {
  place: Place;
  score: number;
  reason: string;
  signal: string;
}

/**
 * Calculates cosine similarity between two numeric vectors.
 */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Use keys of vector A to intersect
  for (const [placeId, ratingA] of a.entries()) {
    normA += ratingA * ratingA;
    const ratingB = b.get(placeId);
    if (ratingB !== undefined) {
      dotProduct += ratingA * ratingB;
    }
  }

  for (const ratingB of b.values()) {
    normB += ratingB * ratingB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Collaborative Filtering + Content-Based Hybrid Recommender Engine.
 */
export async function getPersonalizedRecommendations(
  pool: Pool,
  userId: string,
  limit: number = 6
): Promise<PersonalizedRecommendation[]> {
  // 1. Fetch user's saved places & reviews to build their profile
  const { rows: savedRows } = await pool.query<{ placeId: string }>(
    `SELECT place_id AS "placeId" FROM saved_places WHERE user_id = $1`,
    [userId]
  );
  
  const { rows: reviewRows } = await pool.query<{ placeId: string; rating: number }>(
    `SELECT place_id AS "placeId", rating FROM place_reviews WHERE user_id = $1`,
    [userId]
  );

  const userSaves = new Set(savedRows.map(r => r.placeId));
  const userReviews = new Map(reviewRows.map(r => [r.placeId, r.rating]));

  // Build the target user's preference vector
  // Rating logic: if reviewed, use rating (1-5); if saved only, use implicit rating of 4.0; otherwise 0.
  const targetUserVector = new Map<string, number>();
  userSaves.forEach(pid => targetUserVector.set(pid, 4.0));
  userReviews.forEach((rating, pid) => targetUserVector.set(pid, rating));

  const totalInteractions = targetUserVector.size;

  // 2. Fetch all other users' saves and reviews
  const { rows: otherSaves } = await pool.query<{ userId: string; placeId: string }>(
    `SELECT user_id AS "userId", place_id AS "placeId" FROM saved_places WHERE user_id != $1`,
    [userId]
  );

  const { rows: otherReviews } = await pool.query<{ userId: string; placeId: string; rating: number }>(
    `SELECT user_id AS "userId", place_id AS "placeId", rating FROM place_reviews WHERE user_id != $1`,
    [userId]
  );

  // Group other users' interactions into vectors
  const otherUsersVectors = new Map<string, Map<string, number>>();
  
  otherSaves.forEach(row => {
    if (!otherUsersVectors.has(row.userId)) {
      otherUsersVectors.set(row.userId, new Map());
    }
    otherUsersVectors.get(row.userId)!.set(row.placeId, 4.0);
  });

  otherReviews.forEach(row => {
    if (!otherUsersVectors.has(row.userId)) {
      otherUsersVectors.set(row.userId, new Map());
    }
    otherUsersVectors.get(row.userId)!.set(row.placeId, row.rating);
  });

  // 3. Compute Cosine Similarity with other users
  const userSimilarities = new Map<string, number>();
  for (const [otherId, otherVector] of otherUsersVectors.entries()) {
    const sim = cosineSimilarity(targetUserVector, otherVector);
    if (sim > 0) {
      userSimilarities.set(otherId, sim);
    }
  }

  // 4. Retrieve candidate places from approved_places database (fallback to MOCK_PLACES)
  const { rows: dbPlacesRows } = await pool.query<any>(
    `
    SELECT
      id, title, description, category, image, rating, latitude, longitude, tags, city, locality,
      price_range AS "priceRange", phone, website, hours, review_mood AS "reviewMood"
    FROM approved_places
    `
  );

  let candidatePool: Place[] = dbPlacesRows.map((row: any) => ({
    ...row,
    isOpen: true,
    isTrending: false,
    reviewCount: 0,
    distance: 0,
    hours: row.hours ? (typeof row.hours === "string" ? JSON.parse(row.hours) : row.hours) : undefined,
    reviewMood: row.reviewMood ? (typeof row.reviewMood === "string" ? JSON.parse(row.reviewMood) : row.reviewMood) : undefined
  }));

  if (candidatePool.length === 0) {
    candidatePool = MOCK_PLACES;
  }

  // Exclude places the user already interacted with
  const unvisitedCandidates = candidatePool.filter((place: Place) => !targetUserVector.has(place.id));

  // Determine weighting (Alpha) based on profile density (Cold Start vs Active User)
  // If user has < 2 interactions, collaborative filtering is highly noisy, so we rely 100% on Content-Based.
  // Otherwise, we do a 60% Collaborative / 40% Content-Based blend.
  const alpha = totalInteractions < 2 ? 0.0 : 0.6;

  // Build content-based user profile descriptors
  // Top cities and categories visited by target user
  const visitedPlaces = candidatePool.filter((place: Place) => targetUserVector.has(place.id));
  const cityCounts: Record<string, number> = {};
  const catCounts: Record<string, number> = {};
  visitedPlaces.forEach((p: Place) => {
    cityCounts[p.city] = (cityCounts[p.city] || 0) + 1;
    catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  });

  const favoriteCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Pune";
  const favoriteCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Compute recommendation scores for each candidate
  const recommendations: PersonalizedRecommendation[] = unvisitedCandidates.map((place: Place) => {
    // A. Collaborative Filtering prediction
    let collaborativeScore = 0;
    let simSum = 0;

    for (const [otherId, sim] of userSimilarities.entries()) {
      const otherVector = otherUsersVectors.get(otherId)!;
      const otherRating = otherVector.get(place.id);
      if (otherRating !== undefined) {
        collaborativeScore += sim * otherRating;
        simSum += sim;
      }
    }

    const predictedRating = simSum > 0 ? collaborativeScore / simSum : 0;
    // Normalize Collaborative Rating to 0-1 scale (max rating is 5.0)
    const normCollaborative = predictedRating / 5.0;

    // B. Content-Based score
    // Math: evaluate place similarity using metadata overlap and mood matching score
    const userMood = inferMoodProfile({ explicitMood: favoriteCategory as any });
    const moodSimilarity = getMoodMatchScore(place, userMood);
    
    // Normalize mood score (typically ranges around 0.5 to 1.3)
    const normMood = Math.max(0, Math.min(1.0, (moodSimilarity - 0.4) / 0.9));

    // Affinity boosts based on preferred city and categories
    const cityBoost = place.city === favoriteCity ? 0.3 : 0.0;
    const categoryBoost = favoriteCategory && place.category === favoriteCategory ? 0.2 : 0.0;
    const ratingBoost = (place.rating - 3.0) / 2.0 * 0.1; // small boost for highly rated places

    const contentScore = Math.max(0, Math.min(1.0, normMood + cityBoost + categoryBoost + ratingBoost));

    // C. Hybrid Blend
    const hybridScore = alpha * normCollaborative + (1 - alpha) * contentScore;

    // D. Build contextual reasons & signals
    let reason = "Recommended based on your interest profile.";
    let signal = `Match signal: ${Math.round(hybridScore * 100)}%`;

    if (alpha > 0 && predictedRating > 3.5) {
      reason = `People with similar tastes also saved or rated this highly.`;
      signal = `Collaborative score: ${predictedRating.toFixed(1)}★ (based on ${simSum.toFixed(1)} similarity overlap)`;
    } else if (place.category === favoriteCategory) {
      reason = `Matches your frequent category preference for ${place.category.replace("-", " ")}s.`;
      signal = `Content Affinity: ${Math.round(contentScore * 100)}% match in ${place.city}`;
    } else if (place.city === favoriteCity) {
      reason = `Top pick in your favorite city, ${place.city}.`;
      signal = `Local Match: ${Math.round(contentScore * 100)}% mood compatibility`;
    }

    return {
      place,
      score: hybridScore,
      reason,
      signal
    };
  });

  // Sort by hybrid score in descending order
  return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
}
