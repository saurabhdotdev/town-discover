"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Navigation,
  X,
  ChevronRight,
  Star,
  Shuffle,
  ExternalLink,
  Footprints,
  Flame,
} from "lucide-react";
import { Place } from "@/types";
import { formatPlaceArea, getCategoryLabel } from "@/lib/utils";

interface WanderlustDropProps {
  places: Place[];
  userLocation?: { latitude: number; longitude: number } | null;
  cityName: string;
}

interface Trail {
  neighbourhood: string;
  vibe: string;
  vibeEmoji: string;
  duration: string;
  stops: Place[];
}

const VIBE_PROFILES = [
  { vibe: "Culinary Crawl", emoji: "🍜", durationMin: 90, durationMax: 120, preferCategories: ["cafe", "restaurant", "street-food", "dessert", "ice-cream"] },
  { vibe: "Culture & Chill", emoji: "🏛️", durationMin: 60, durationMax: 90, preferCategories: ["nightlife", "cafe", "bar"] },
  { vibe: "Hidden Gems Trail", emoji: "💎", durationMin: 75, durationMax: 105, preferCategories: ["cafe", "restaurant", "food-stall"] },
  { vibe: "Night Owl Circuit", emoji: "🦉", durationMin: 90, durationMax: 150, preferCategories: ["bar", "nightlife", "cafe", "dessert"] },
  { vibe: "Street Food Safari", emoji: "🛺", durationMin: 60, durationMax: 90, preferCategories: ["street-food", "food-stall", "dessert"] },
];

function pickRandomTrail(places: Place[]): Trail | null {
  if (places.length < 3) return null;

  // Group places by locality
  const byLocality = new Map<string, Place[]>();
  places.forEach((p) => {
    const key = p.locality || p.city;
    if (!byLocality.has(key)) byLocality.set(key, []);
    byLocality.get(key)!.push(p);
  });

  // Filter localities with at least 3 places
  const validLocalities = Array.from(byLocality.entries()).filter(
    ([, ps]) => ps.length >= 3
  );
  if (validLocalities.length === 0) return null;

  // Pick a random locality
  const [neighbourhood, localPlaces] =
    validLocalities[Math.floor(Math.random() * validLocalities.length)];

  // Pick a random vibe profile
  const vibeProfile =
    VIBE_PROFILES[Math.floor(Math.random() * VIBE_PROFILES.length)];

  // Sort local places: prefer vibe-matching categories, then by rating
  const sorted = [...localPlaces].sort((a, b) => {
    const aMatch = vibeProfile.preferCategories.includes(a.category) ? 1 : 0;
    const bMatch = vibeProfile.preferCategories.includes(b.category) ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return b.rating - a.rating;
  });

  // Pick top 3 stops
  const stops = sorted.slice(0, 3);
  const durationMins =
    vibeProfile.durationMin +
    Math.floor(Math.random() * (vibeProfile.durationMax - vibeProfile.durationMin));
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  const duration = hours > 0 ? `${hours}h ${mins > 0 ? mins + "m" : ""}` : `${mins}m`;

  return {
    neighbourhood,
    vibe: vibeProfile.vibe,
    vibeEmoji: vibeProfile.emoji,
    duration,
    stops,
  };
}

function buildGoogleMapsUrl(
  stops: Place[],
  userLocation?: { latitude: number; longitude: number } | null
): string {
  if (stops.length === 0) return "https://maps.google.com";

  const destination = stops[stops.length - 1];
  const destStr = `${destination.latitude},${destination.longitude}`;

  let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destStr)}&travelmode=driving`;

  if (userLocation) {
    url += `&origin=${encodeURIComponent(`${userLocation.latitude},${userLocation.longitude}`)}`;
  }

  if (stops.length > 1) {
    const waypoints = stops
      .slice(0, -1)
      .map((s) => `${s.latitude},${s.longitude}`)
      .join("|");
    url += `&waypoints=${encodeURIComponent(waypoints)}`;
  }

  return url;
}

function buildGoogleMapsStreetViewUrl(place: Place): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${place.latitude},${place.longitude}`;
}

export function WanderlustDrop({
  places,
  userLocation,
  cityName,
}: WanderlustDropProps) {
  const [open, setOpen] = useState(false);
  const [trail, setTrail] = useState<Trail | null>(null);
  const [generating, setGenerating] = useState(false);

  const generateTrail = useCallback(() => {
    setGenerating(true);
    // Small artificial delay for drama
    setTimeout(() => {
      const result = pickRandomTrail(places);
      setTrail(result);
      setGenerating(false);
      setOpen(true);
    }, 800);
  }, [places]);

  const reroll = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      const result = pickRandomTrail(places);
      setTrail(result);
      setGenerating(false);
    }, 500);
  }, [places]);

  const mapsUrl = trail ? buildGoogleMapsUrl(trail.stops, userLocation) : "#";

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={generateTrail}
        disabled={generating || places.length < 3}
        className="group relative inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 px-4 py-2.5 text-xs font-black text-amber-300 shadow-lg shadow-amber-500/10 backdrop-blur-md transition-all hover:border-amber-400/60 hover:bg-amber-500/20 hover:shadow-amber-500/20 active:scale-[0.97] disabled:opacity-50"
      >
        <span className={`transition-transform ${generating ? "animate-spin" : "group-hover:rotate-180"}`}>
          <Compass size={16} />
        </span>
        {generating ? "Finding your adventure…" : "Wanderlust Drop"}
        {!generating && (
          <span className="absolute -right-1 -top-1 flex h-2 w-2 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
          </span>
        )}
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && trail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.96 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-2xl sm:rounded-2xl border border-amber-400/20 bg-[#0a0d12] shadow-2xl shadow-amber-500/10"
            >
              {/* Top glow strip */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

              {/* Header */}
              <div className="relative overflow-hidden px-5 pt-5 pb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.06] via-orange-500/[0.04] to-transparent" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">
                      <Compass size={10} />
                      Wanderlust Drop — {cityName}
                    </div>
                    <h2 className="text-xl font-black text-white">
                      {trail.vibeEmoji} {trail.neighbourhood}
                    </h2>
                    <p className="mt-0.5 text-xs font-semibold text-amber-300/80">
                      {trail.vibe} · {trail.duration} adventure · {trail.stops.length} stops
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Trail stops */}
              <div className="px-5 pb-2">
                <div className="relative space-y-0">
                  {/* Timeline line */}
                  <div className="absolute left-3.5 top-4 bottom-4 w-px bg-gradient-to-b from-amber-400/60 via-amber-400/20 to-transparent" />

                  {trail.stops.map((stop, i) => (
                    <div key={stop.id} className="relative flex gap-4 pb-4">
                      {/* Node */}
                      <div className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#0a0d12] bg-amber-400 text-[10px] font-black text-black shadow-md shadow-amber-400/30">
                        {i + 1}
                        {i === 0 && (
                          <span className="absolute h-full w-full animate-ping rounded-full bg-amber-400/40" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition hover:border-amber-400/20 hover:bg-amber-400/[0.04]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-400/70">
                              Stop {i + 1} · {getCategoryLabel(stop.category, stop.tags)}
                            </p>
                            <h3 className="mt-0.5 truncate text-sm font-black text-white">
                              {stop.title}
                            </h3>
                            <p className="mt-0.5 truncate text-[11px] font-semibold text-white/40">
                              {formatPlaceArea(stop)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-400">
                              <Star size={9} className="fill-amber-400" />
                              {stop.rating}
                            </span>
                            {/* Street View link */}
                            <a
                              href={buildGoogleMapsStreetViewUrl(stop)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] font-bold text-white/30 hover:text-amber-400 transition flex items-center gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={8} />
                              Street View
                            </a>
                          </div>
                        </div>

                        {/* Walking time between stops */}
                        {i < trail.stops.length - 1 && (
                          <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-white/25">
                            <Footprints size={9} />
                            ~{5 + i * 3}–{8 + i * 3} min walk to next stop
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action row */}
              <div className="flex gap-2 border-t border-white/[0.06] px-5 py-4">
                {/* Reroll */}
                <button
                  type="button"
                  onClick={reroll}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-white/60 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
                >
                  <Shuffle size={13} className={generating ? "animate-spin" : ""} />
                  {generating ? "Rolling…" : "Reroll"}
                </button>

                {/* Open in Google Maps — Full Route */}
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-xs font-black text-black shadow-lg shadow-amber-500/20 transition hover:opacity-90 active:scale-[0.97]"
                >
                  <Navigation size={14} />
                  Start Adventure in Google Maps
                  <ChevronRight size={13} />
                </a>
              </div>

              {/* Bottom disclaimer */}
              <div className="flex items-center justify-center gap-1.5 border-t border-white/[0.04] px-5 py-2.5 text-[9px] font-semibold text-white/20">
                <Flame size={9} className="text-amber-400/40" />
                Opens Google Maps with full multi-stop route &amp; directions
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
