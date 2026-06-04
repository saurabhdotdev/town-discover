"use client";

import { motion } from "framer-motion";

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
}

const ALL_BADGES: BadgeDef[] = [
  { id: "first-save", name: "Wishlist Starter", description: "Save your first place.", emoji: "🌱", category: "saves" },
  { id: "collector", name: "Collector", description: "Save 5 different spots.", emoji: "📌", category: "saves" },
  { id: "curator", name: "Curator", description: "Save 20 places.", emoji: "🎨", category: "saves" },
  { id: "night-rider", name: "Night Rider", description: "Save a night-drive route.", emoji: "🌙", category: "special" },
  { id: "street-food-guru", name: "Street Food Guru", description: "Save 3 street-food spots.", emoji: "🍢", category: "saves" },
  { id: "city-eye", name: "City Eye", description: "Submit your first crowd report.", emoji: "👁", category: "reports" },
  { id: "signal-sender", name: "Signal Sender", description: "Submit 5 crowd reports.", emoji: "📡", category: "reports" },
  { id: "community-scout", name: "Community Scout", description: "Suggest your first place.", emoji: "🗺", category: "suggestions" },
  { id: "spot-approved", name: "Spot Approved", description: "Get a suggestion approved!", emoji: "✅", category: "suggestions" },
  { id: "first-review", name: "Local Critic", description: "Write your first place review.", emoji: "✍️", category: "reviews" },
  { id: "pro-critic", name: "Pro Critic", description: "Write 5 place reviews.", emoji: "📝", category: "reviews" },
  { id: "elite-critic", name: "Elite Critic", description: "Write 15 place reviews.", emoji: "👑", category: "reviews" },
];

interface BadgeShelfProps {
  earnedBadgeIds: string[];
}

export const BadgeShelf: React.FC<BadgeShelfProps> = ({ earnedBadgeIds }) => {
  const earnedSet = new Set(earnedBadgeIds);

  return (
    <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {ALL_BADGES.map((badge, i) => {
        const earned = earnedSet.has(badge.id);
        return (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            title={`${badge.name}: ${badge.description}`}
            className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all cursor-default ${
              earned
                ? "border-teal-400/40 bg-gradient-to-b from-teal-500/10 to-slate-900/80 shadow-lg shadow-teal-500/10"
                : "border-white/5 bg-white/[0.02] opacity-40 grayscale"
            }`}
          >
            {earned && (
              <div className="absolute inset-0 rounded-xl bg-teal-400/5 blur-xl" />
            )}
            <span className={`text-2xl leading-none transition-all ${earned ? "drop-shadow-[0_0_8px_rgba(94,234,212,0.6)]" : ""}`}>
              {badge.emoji}
            </span>
            <span className={`text-[10px] font-black leading-tight uppercase tracking-wide ${earned ? "text-teal-200" : "text-slate-500"}`}>
              {badge.name}
            </span>
            {!earned && (
              <span className="absolute right-1.5 top-1.5 text-[8px] text-slate-600">🔒</span>
            )}
            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 w-40 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-[10px] text-slate-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity shadow-xl text-left">
              <p className="font-black text-white mb-0.5">{badge.name}</p>
              <p>{badge.description}</p>
              {!earned && <p className="mt-1 text-slate-500 italic">Not yet earned</p>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
