"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Coffee,
  Sunrise,
  Compass,
  Laptop,
  UtensilsCrossed,
  Sunset,
  Camera,
  Sparkles,
  MapPin,
  Music,
  Wine,
  Calendar,
  Moon,
  Car,
  Clock,
  Star,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { Place } from "@/types";
import { formatDistance, getCategoryLabel } from "@/lib/utils";

// Define the vibe phases of the day
export type VibePhase = "morning" | "midday" | "golden" | "tonight" | "midnight";

interface VibeRadarProps {
  places: Place[];
  activeCity: string;
  onPlaceClick: (place: Place) => void;
  className?: string;
}

interface PhaseConfig {
  id: VibePhase;
  label: string;
  timeRange: string;
  icon: React.ReactNode;
  accentClass: string;
  gradientFrom: string;
  glowColor: string;
  poeticVibe: string;
  radarColor: string;
}

const PHASES: PhaseConfig[] = [
  {
    id: "morning",
    label: "Morning Freshness",
    timeRange: "6:00 AM - 11:00 AM",
    icon: <Sunrise size={18} />,
    accentClass: "text-amber-200 border-amber-500/30 bg-amber-500/10",
    gradientFrom: "from-amber-500/20 via-sky-500/10 to-transparent",
    glowColor: "rgba(245, 158, 11, 0.4)",
    poeticVibe: "Cool breeze, early queues, filter coffee runs, and a quiet city waking up.",
    radarColor: "#f59e0b",
  },
  {
    id: "midday",
    label: "Midday Escape",
    timeRange: "11:00 AM - 4:00 PM",
    icon: <Laptop size={18} />,
    accentClass: "text-cyan-200 border-cyan-500/30 bg-cyan-500/10",
    gradientFrom: "from-cyan-500/20 via-blue-500/10 to-transparent",
    glowColor: "rgba(6, 182, 212, 0.4)",
    poeticVibe: "Specialty brews, sunlit workspaces, quiet reading rooms, and fresh lunches.",
    radarColor: "#06b6d4",
  },
  {
    id: "golden",
    label: "Golden Hour Pulse",
    timeRange: "4:00 PM - 7:00 PM",
    icon: <Sunset size={18} />,
    accentClass: "text-orange-200 border-orange-500/30 bg-orange-500/10",
    gradientFrom: "from-orange-500/20 via-pink-500/10 to-transparent",
    glowColor: "rgba(249, 115, 22, 0.4)",
    poeticVibe: "Warm skies, scenic hilltop treks, rooftop hangouts, and warm street food strolls.",
    radarColor: "#f97316",
  },
  {
    id: "tonight",
    label: "Happening Tonight",
    timeRange: "7:00 PM - 11:00 PM",
    icon: <Music size={18} />,
    accentClass: "text-fuchsia-200 border-fuchsia-500/30 bg-fuchsia-500/10",
    gradientFrom: "from-fuchsia-500/20 via-indigo-500/10 to-transparent",
    glowColor: "rgba(217, 70, 239, 0.4)",
    poeticVibe: "Dim lighting, live acoustic gigs, craft pours, and warm dinner streets alive with energy.",
    radarColor: "#d946ef",
  },
  {
    id: "midnight",
    label: "Midnight Munchies",
    timeRange: "11:00 PM - 6:00 AM",
    icon: <Moon size={18} />,
    accentClass: "text-purple-200 border-purple-500/30 bg-purple-500/10",
    gradientFrom: "from-purple-900/20 via-slate-900/40 to-transparent",
    glowColor: "rgba(168, 85, 247, 0.4)",
    poeticVibe: "Empty highways, late-night scoop shops, 24/7 drive cafes, and hilltop scenic lookouts.",
    radarColor: "#a855f7",
  },
];

// Helper to auto-detect time phase
const getAutoDetectedPhase = (): VibePhase => {
  if (typeof window === "undefined") return "midday";
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "midday";
  if (hour >= 16 && hour < 19) return "golden";
  if (hour >= 19 && hour < 23) return "tonight";
  return "midnight";
};

export const VibeRadar: React.FC<VibeRadarProps> = ({
  places,
  activeCity,
  onPlaceClick,
  className = "",
}) => {
  const [selectedPhase, setSelectedPhase] = useState<VibePhase>("midday");
  const [isTimeTraveling, setIsTimeTraveling] = useState(false);
  const [localTimeStr, setLocalTimeStr] = useState("");

  // Detect and set local time and phase on boot
  useEffect(() => {
    const active = getAutoDetectedPhase();
    setSelectedPhase(active);

    const updateTime = () => {
      const now = new Date();
      setLocalTimeStr(
        now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const activePhase = useMemo(
    () => PHASES.find((p) => p.id === selectedPhase)!,
    [selectedPhase]
  );

  // Filter recommendations based on active phase matching keywords/tags
  const activeRecommendations = useMemo(() => {
    if (!places.length) return [];

    let filtered = places;

    if (selectedPhase === "morning") {
      filtered = places.filter(
        (p) =>
          ["cafe", "event"].includes(p.category) ||
          p.tags.some((tag) =>
            [
              "breakfast",
              "morning",
              "filter-coffee",
              "south-indian",
              "sunrise",
              "trail",
              "outdoors",
              "walk",
            ].includes(tag.toLowerCase())
          )
      );
    } else if (selectedPhase === "midday") {
      filtered = places.filter(
        (p) =>
          ["cafe", "restaurant", "dessert"].includes(p.category) ||
          p.tags.some((tag) =>
            [
              "lunch",
              "bakery",
              "specialty-coffee",
              "workspace",
              "quiet",
              "brunch",
            ].includes(tag.toLowerCase())
          )
      );
    } else if (selectedPhase === "golden") {
      filtered = places.filter((p) =>
        p.tags.some((tag) =>
          [
            "sunset",
            "viewpoint",
            "rooftop",
            "scenic",
            "outdoor",
            "sea-face",
            "lake",
            "walk",
            "garden",
            "nature",
          ].includes(tag.toLowerCase())
        )
      );
    } else if (selectedPhase === "tonight") {
      filtered = places.filter(
        (p) =>
          ["nightlife", "bar", "restaurant"].includes(p.category) ||
          p.tags.some((tag) =>
            [
              "live-music",
              "nightlife",
              "gigs",
              "dinner",
              "brewpub",
              "beer",
              "lively",
              "music",
            ].includes(tag.toLowerCase())
          )
      );
    } else if (selectedPhase === "midnight") {
      filtered = places.filter((p) =>
        p.tags.some((tag) =>
          [
            "night-drive",
            "scenic-cruise",
            "late-night",
            "24-7",
            "midnight",
            "desserts",
            "ice-cream",
          ].includes(tag.toLowerCase())
        )
      );
    }

    // Sort by rating & proximity to ensure premium curation
    const sorted = [...filtered].sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return a.distance - b.distance;
    });

    // Fallback if phase yields too few places
    if (sorted.length < 4) {
      const remaining = places
        .filter((p) => !sorted.some((s) => s.id === p.id))
        .sort((a, b) => b.rating - a.rating);
      return [...sorted, ...remaining].slice(0, 4);
    }

    return sorted.slice(0, 4);
  }, [places, selectedPhase]);

  const handlePhaseChange = (phase: VibePhase) => {
    setIsTimeTraveling(true);
    setSelectedPhase(phase);
    setTimeout(() => setIsTimeTraveling(false), 300);
  };

  return (
    <div
      className={`app-surface relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5 md:p-6 shadow-2xl backdrop-blur-xl ${className}`}
    >
      {/* Dynamic ambient backdrop glowing circle */}
      <div
        className="absolute -left-10 -top-10 h-72 w-72 rounded-full opacity-15 blur-[96px] pointer-events-none transition duration-1000 ease-out"
        style={{ backgroundColor: activePhase.radarColor }}
      />
      <div
        className="absolute -right-10 -bottom-10 h-72 w-72 rounded-full opacity-10 blur-[96px] pointer-events-none transition duration-1000 ease-out"
        style={{ backgroundColor: activePhase.radarColor }}
      />

      {/* Decorative time-based gradient background glow */}
      <div
        className={`absolute inset-0 bg-gradient-to-tr ${activePhase.gradientFrom} pointer-events-none transition duration-1000`}
      />

      <div className="relative z-10 flex flex-col gap-6 md:grid md:grid-cols-[250px_1fr] lg:grid-cols-[280px_1fr] md:items-center">
        {/* Left Column: Visual Radar Dial */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative flex h-52 w-52 items-center justify-center sm:h-56 sm:w-56 rounded-full border border-slate-800/60 bg-slate-950/40 shadow-inner">
            {/* Spinning Conical Radar Sweep (Authentic Cathode Ray Trail) */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
              style={{ transformOrigin: "center center" }}
              className="absolute inset-0 rounded-full pointer-events-none z-10"
            >
              {/* Conical gradient representing sweep lighting fade */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(from 270deg, ${activePhase.radarColor}33 0deg, ${activePhase.radarColor}00 90deg)`,
                }}
              />
              {/* Radar beam leading edge line */}
              <div
                className="h-1/2 w-[2px] mx-auto opacity-90"
                style={{
                  background: `linear-gradient(to top, transparent, ${activePhase.radarColor})`,
                  boxShadow: `0 0 14px 2px ${activePhase.radarColor}`,
                }}
              />
            </motion.div>

            {/* Glowing concentric rings and crosshair grids */}
            <div className="absolute inset-0 rounded-full border border-slate-800/35 pointer-events-none" />
            <div className="absolute h-[75%] w-[75%] rounded-full border border-slate-800/25 pointer-events-none" />
            <div className="absolute h-[50%] w-[50%] rounded-full border border-slate-800/15 pointer-events-none" />
            <div className="absolute h-[25%] w-[25%] rounded-full border border-slate-800/10 pointer-events-none" />
            
            {/* Crosshairs */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-slate-800/15 pointer-events-none" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-slate-800/15 pointer-events-none" />

            {/* Glowing Floating Place Markers */}
            <AnimatePresence mode="popLayout">
              {activeRecommendations.map((place, idx) => {
                // Calculate position angles based on rating to distribute them across the sectors
                const angle = (idx * 90 + 35 + (place.rating * 12)) % 360;
                const distanceRatio = 0.38 + (idx * 0.11); // float markers nicely between 38% and 75% out
                const angleRad = (angle * Math.PI) / 180;
                const x = 50 + Math.cos(angleRad) * 50 * distanceRatio;
                const y = 50 + Math.sin(angleRad) * 50 * distanceRatio;

                return (
                  <motion.button
                    key={place.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ delay: idx * 0.08, type: "spring", stiffness: 200, damping: 15 }}
                    whileHover={{ scale: 1.3 }}
                    onClick={() => onPlaceClick(place)}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-30"
                    aria-label={`Open details for ${place.title}`}
                  >
                    {/* Pulsing ripple wave */}
                    <div
                      className="absolute -inset-2.5 rounded-full opacity-30 animate-ping pointer-events-none"
                      style={{ backgroundColor: activePhase.radarColor }}
                    />
                    {/* Inner glowing dot */}
                    <div
                      className="h-3.5 w-3.5 rounded-full border-2 border-white shadow-lg relative z-10 transition duration-300 group-hover:border-teal-200"
                      style={{
                        backgroundColor: activePhase.radarColor,
                        boxShadow: `0 0 12px 3px ${activePhase.glowColor}`,
                      }}
                    />
                    {/* Premium glassmorphic tooltip card */}
                    <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 bg-slate-950/90 border border-slate-800/80 backdrop-blur-md rounded px-2.5 py-1.5 text-[10px] font-black text-white whitespace-nowrap shadow-2xl transition-all duration-300 pointer-events-none z-50 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activePhase.radarColor }} />
                      {place.title}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>

            {/* Inner Clock Hub */}
            <div className="absolute flex h-14 w-14 flex-col items-center justify-center rounded-full bg-slate-950 border border-slate-800 shadow-2xl text-center z-20">
              <Clock size={16} style={{ color: activePhase.radarColor }} className="animate-pulse" />
              <span className="mt-0.5 text-[9px] font-black text-slate-300 tracking-tight">{localTimeStr || "--:--"}</span>
            </div>
          </div>

          <div className="mt-3 text-center">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Radar Sweep Live
            </span>
          </div>
        </div>

        {/* Right Column: Information panel & Place recommendations grid */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.16em] transition duration-500 ${activePhase.accentClass}`}
              >
                {activePhase.icon}
                {activePhase.label}
              </span>
              <span className="text-xs font-semibold text-slate-400 bg-slate-950 border border-slate-800/40 rounded-full px-2.5 py-1">
                ⏱️ {activePhase.timeRange}
              </span>
            </div>

            <p className="text-sm font-semibold italic text-slate-300 leading-relaxed max-w-xl transition duration-500">
              &ldquo;{activePhase.poeticVibe}&rdquo;
            </p>
          </div>

          {/* Place Cards Responsive Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AnimatePresence mode="wait">
              {isTimeTraveling ? (
                // Skeleton loading state on time travel transition
                Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={`skeleton-${idx}`}
                    className="h-28 animate-pulse rounded-xl border border-slate-900 bg-slate-900/40"
                  />
                ))
              ) : (
                activeRecommendations.map((place, idx) => (
                  <motion.button
                    key={place.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    onClick={() => onPlaceClick(place)}
                    className="group relative flex h-28 w-full overflow-hidden rounded-xl border border-slate-800/40 bg-slate-950/20 text-left transition duration-300 hover:border-slate-600 hover:bg-slate-900/40 shadow-md hover:shadow-2xl active:scale-[0.98] cursor-pointer"
                  >
                    {/* Card Border Glow effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    {/* Place image backdrop */}
                    <div className="relative h-full w-20 shrink-0 bg-slate-900 overflow-hidden">
                      <Image
                        src={place.image}
                        alt={place.title}
                        fill
                        sizes="80px"
                        className="object-cover transition duration-500 group-hover:scale-110"
                      />
                    </div>

                    {/* Place metadata */}
                    <div className="flex flex-col justify-between p-3 min-w-0 flex-1 relative z-10">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                            {getCategoryLabel(place.category)}
                          </span>
                          {/* Open/Closed status LED */}
                          {place.isOpen ? (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 rounded-full px-1.5 py-0.5 border border-emerald-500/20">
                              <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                              Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black text-rose-400 uppercase tracking-widest bg-rose-500/10 rounded-full px-1.5 py-0.5 border border-rose-500/20">
                              <span className="h-1 w-1 rounded-full bg-rose-500" />
                              Closed
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-black tracking-tight text-white line-clamp-1 group-hover:text-emerald-300 transition-colors duration-200">
                          {place.title}
                        </h4>
                        <p className="text-[10px] font-medium text-slate-400 line-clamp-1">
                          {place.locality}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300">
                        <span className="inline-flex items-center gap-0.5 font-black text-amber-400 bg-amber-400/10 rounded px-1 border border-amber-400/20">
                          ★ {place.rating}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-slate-400">
                          <MapPin size={9} />
                          {formatDistance(place.distance)}
                        </span>
                      </div>
                    </div>
                  </motion.button>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Time-Travel Dial Tabs Selector */}
          <div className="mt-2 border-t border-slate-800/40 pt-3">
            <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
              ⏰ Quick Time-Travel Dial
            </p>
            <div className="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto pb-1.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {PHASES.map((phase) => {
                const active = selectedPhase === phase.id;
                return (
                  <motion.button
                    key={phase.id}
                    type="button"
                    whileHover={{ scale: 1.04, y: -0.5 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handlePhaseChange(phase.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[10px] font-black uppercase tracking-wider transition cursor-pointer select-none ${
                      active
                        ? "bg-white text-slate-950 shadow-xl shadow-white/5 border border-white"
                        : "border border-slate-800/80 bg-slate-900/30 text-slate-400 hover:border-slate-700/60 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                  >
                    {phase.icon}
                    <span>{phase.label.split(" ")[0]}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VibeRadar;
