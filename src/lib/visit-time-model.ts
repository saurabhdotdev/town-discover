import { Place } from "@/types";

export type CrowdIntensity = "quiet" | "moderate" | "busy" | "peak";

export interface RealSignal {
  hourOfDay: number;   // 0-23
  avgScore: number;    // 1.0–4.0 (maps to crowd score: low=1 .. very_crowded=4)
  sampleCount: number;
}

export interface HourlySlot {
  hour: number;           // 7..23
  label: string;          // "7am", "8pm" etc.
  intensity: CrowdIntensity;
  score: number;          // 0..1  (0=empty, 1=packed)
  isNow: boolean;
  isRealData: boolean;    // true when derived from real crowd reports
}

export interface VisitTimeProfile {
  bestHour: number;
  bestLabel: string;
  bestDayOfWeek: "weekday" | "weekend";
  bestDayLabel: string;
  currentIntensity: CrowdIntensity;
  currentScore: number;
  hourlySlots: HourlySlot[];
  tip: string;
  hasRealData: boolean;   // true when at least one slot uses real crowd data
}


// ── Category-specific crowd shape ──────────────────────────────────────────────
//
// Each entry defines the peaks in a 24-hour day.
// Model: sum of Gaussians  f(h) = Σ A_i * exp(-(h - μ_i)² / (2σ_i²))
// Then capped to [0,1].
//

interface GaussianPeak {
  mu: number;    // peak hour (0-23)
  sigma: number; // spread in hours
  amp: number;   // amplitude 0..1
}

const CATEGORY_PEAKS: Record<string, GaussianPeak[]> = {
  cafe: [
    { mu: 9,  sigma: 1.2, amp: 0.80 },   // morning coffee rush
    { mu: 12, sigma: 1.0, amp: 0.55 },   // quick lunch
    { mu: 16, sigma: 1.5, amp: 0.90 },   // evening chai/latte peak
  ],
  restaurant: [
    { mu: 13, sigma: 1.0, amp: 0.85 },   // lunch peak
    { mu: 20, sigma: 1.2, amp: 1.00 },   // dinner peak
  ],
  "food-stall": [
    { mu: 8,  sigma: 0.8, amp: 0.60 },
    { mu: 13, sigma: 1.0, amp: 0.75 },
    { mu: 19, sigma: 1.0, amp: 0.90 },
  ],
  "street-food": [
    { mu: 12, sigma: 1.2, amp: 0.70 },
    { mu: 19, sigma: 1.5, amp: 1.00 },
    { mu: 22, sigma: 0.8, amp: 0.60 },
  ],
  dessert: [
    { mu: 15, sigma: 1.2, amp: 0.65 },
    { mu: 20, sigma: 1.5, amp: 0.95 },
  ],
  "ice-cream": [
    { mu: 14, sigma: 1.5, amp: 0.85 },
    { mu: 19, sigma: 1.2, amp: 1.00 },
  ],
  bar: [
    { mu: 20, sigma: 1.2, amp: 0.80 },
    { mu: 22, sigma: 1.0, amp: 1.00 },
  ],
  nightlife: [
    { mu: 21, sigma: 1.0, amp: 0.75 },
    { mu: 23, sigma: 0.8, amp: 1.00 },
  ],
  event: [
    { mu: 11, sigma: 1.5, amp: 0.70 },
    { mu: 18, sigma: 1.5, amp: 0.90 },
  ],
};

const DEFAULT_PEAKS: GaussianPeak[] = [
  { mu: 12, sigma: 1.5, amp: 0.65 },
  { mu: 18, sigma: 1.5, amp: 0.80 },
];

// Weekend boosts certain categories
const WEEKEND_BOOST: Record<string, number> = {
  restaurant: 0.15,
  "ice-cream": 0.20,
  cafe: 0.10,
  event: 0.25,
  nightlife: 0.30,
  bar: 0.25,
};

/**
 * Gaussian kernel evaluation
 */
function gaussian(h: number, peak: GaussianPeak): number {
  return peak.amp * Math.exp(-((h - peak.mu) ** 2) / (2 * peak.sigma ** 2));
}

/**
 * Compute crowd score for a given hour/day on a scale of 0..1
 */
function computeScore(
  hour: number,
  category: string,
  isWeekend: boolean,
  rating: number
): number {
  const peaks = CATEGORY_PEAKS[category] ?? DEFAULT_PEAKS;
  let raw = peaks.reduce((sum, p) => sum + gaussian(hour, p), 0);

  // Clamp to 0..1
  raw = Math.min(1, Math.max(0, raw));

  // Weekend boost
  const boost = isWeekend ? (WEEKEND_BOOST[category] ?? 0.10) : 0;
  raw = Math.min(1, raw + boost);

  // High-rated places draw more people
  const ratingFactor = 1 + (rating - 3.5) * 0.08;
  raw = Math.min(1, raw * ratingFactor);

  return raw;
}

function scoreToIntensity(score: number): CrowdIntensity {
  if (score < 0.25) return "quiet";
  if (score < 0.55) return "moderate";
  if (score < 0.80) return "busy";
  return "peak";
}

function formatHourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  if (h < 12) return `${h}am`;
  return `${h - 12}pm`;
}

/**
 * Find the hour with the peak crowd (for tip messaging)
 */
function getPeakHour(category: string): number {
  const peaks = CATEGORY_PEAKS[category] ?? DEFAULT_PEAKS;
  return peaks.reduce((best, p) => (p.amp > (CATEGORY_PEAKS[category]?.find(x => x.mu === best)?.amp ?? 0) ? p.mu : best), peaks[0].mu);
}

function buildTip(
  bestHour: number,
  currentIntensity: CrowdIntensity,
  category: string,
  isWeekend: boolean
): string {
  const bestDayLabel = isWeekend ? "weekends" : "weekdays";
  const peakHour = getPeakHour(category);

  if (currentIntensity === "quiet") {
    return `🟢 Great time to visit — it's quiet right now. Peak hours are usually around ${formatHourLabel(peakHour)}.`;
  }
  if (currentIntensity === "peak") {
    return `🔴 Peak hours now. Come back around ${formatHourLabel(bestHour)} for a quieter experience.`;
  }
  if (currentIntensity === "busy") {
    return `🟡 Getting busy. Best time is ${formatHourLabel(bestHour)} on ${bestDayLabel}.`;
  }
  return `Best time to visit: ${formatHourLabel(bestHour)} on ${bestDayLabel}.`;
}

/**
 * Normalise a raw crowd score (1-4 scale) to 0..1
 */
function normalizeRealScore(avgScore: number): number {
  // avgScore is 1..4 → map to 0..1
  return Math.min(1, Math.max(0, (avgScore - 1) / 3));
}

/**
 * Main model entry point.
 * Returns a full VisitTimeProfile for a place at the current time.
 *
 * @param realSignals  Optional real hourly signals from the backend API
 *                     (/api/visit-time). When provided, each slot with
 *                     ≥3 samples blends: 70% real + 30% Gaussian.
 */
export function getVisitTimeProfile(
  place: Place,
  now = new Date(),
  realSignals: RealSignal[] = []
): VisitTimeProfile {
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const category = place.category;
  const rating = place.rating ?? 4.0;

  // Build a quick lookup from real signals
  const realByHour = new Map<number, RealSignal>();
  for (const s of realSignals) {
    realByHour.set(s.hourOfDay, s);
  }

  // Hours 7am..11pm (17 slots)
  const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

  // Build hourly slots, blending real + Gaussian
  let hasRealData = false;
  const hourlySlots: HourlySlot[] = HOURS.map((h) => {
    const gaussianScore = computeScore(h, category, isWeekend, rating);
    const real = realByHour.get(h);

    let finalScore: number;
    let isRealData = false;

    if (real && real.sampleCount >= 3) {
      // Blend: 70% real signal + 30% Gaussian prior
      const realNorm = normalizeRealScore(real.avgScore);
      finalScore = 0.70 * realNorm + 0.30 * gaussianScore;
      isRealData = true;
      hasRealData = true;
    } else {
      finalScore = gaussianScore;
    }

    return {
      hour: h,
      label: formatHourLabel(h),
      intensity: scoreToIntensity(finalScore),
      score: finalScore,
      isNow: h === hour,
      isRealData,
    };
  });

  // Best hour = quietest during visitable window (7am–10pm)
  const visitableSlots = hourlySlots.filter(s => s.hour >= 7 && s.hour <= 22);
  const bestSlot = visitableSlots.reduce(
    (best, s) => (s.score < best.score ? s : best),
    visitableSlots[0]
  );

  // Best day of week: weekday vs weekend by average Gaussian load
  const weekdayAvg = HOURS.reduce((sum, h) => sum + computeScore(h, category, false, rating), 0) / HOURS.length;
  const weekendAvg = HOURS.reduce((sum, h) => sum + computeScore(h, category, true, rating), 0) / HOURS.length;
  const bestDayOfWeek: "weekday" | "weekend" = weekdayAvg <= weekendAvg ? "weekday" : "weekend";
  const bestDayLabel = bestDayOfWeek === "weekday" ? "Weekday mornings" : "Weekend afternoons";

  // Current slot score
  const currentSlot = hourlySlots.find(s => s.hour === hour) ?? hourlySlots[0];
  const currentScore = currentSlot.score;
  const currentIntensity = currentSlot.intensity;

  return {
    bestHour: bestSlot.hour,
    bestLabel: formatHourLabel(bestSlot.hour),
    bestDayOfWeek,
    bestDayLabel,
    currentIntensity,
    currentScore,
    hourlySlots,
    tip: buildTip(bestSlot.hour, currentIntensity, category, isWeekend),
    hasRealData,
  };
}
