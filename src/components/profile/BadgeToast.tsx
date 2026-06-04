"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BADGE_INFO: Record<string, { name: string; emoji: string }> = {
  "first-save": { name: "Wishlist Starter", emoji: "🌱" },
  "collector": { name: "Collector", emoji: "📌" },
  "curator": { name: "Curator", emoji: "🎨" },
  "night-rider": { name: "Night Rider", emoji: "🌙" },
  "street-food-guru": { name: "Street Food Guru", emoji: "🍢" },
  "city-eye": { name: "City Eye", emoji: "👁" },
  "signal-sender": { name: "Signal Sender", emoji: "📡" },
  "community-scout": { name: "Community Scout", emoji: "🗺" },
  "spot-approved": { name: "Spot Approved", emoji: "✅" },
  "first-review": { name: "Local Critic", emoji: "✍️" },
  "pro-critic": { name: "Pro Critic", emoji: "📝" },
  "elite-critic": { name: "Elite Critic", emoji: "👑" },
};

interface BadgeToastProps {
  badgeId: string | null;
  onDismiss: () => void;
}

export const BadgeToast: React.FC<BadgeToastProps> = ({ badgeId, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!badgeId) { setVisible(false); return; }
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 4500);
    return () => clearTimeout(timer);
  }, [badgeId, onDismiss]);

  const info = badgeId ? BADGE_INFO[badgeId] : null;

  return (
    <AnimatePresence>
      {visible && info && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="fixed bottom-6 right-4 z-[20000] flex items-center gap-3 rounded-xl border border-teal-400/30 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur-xl sm:right-6"
          onClick={() => { setVisible(false); setTimeout(onDismiss, 400); }}
        >
          {/* Glow orb */}
          <div className="absolute inset-0 rounded-xl bg-teal-400/5 blur-xl pointer-events-none" />
          <span className="text-3xl leading-none drop-shadow-[0_0_12px_rgba(94,234,212,0.7)]">
            {info.emoji}
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">
              🏆 Badge Unlocked!
            </p>
            <p className="text-sm font-black text-white">{info.name}</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setVisible(false); setTimeout(onDismiss, 400); }}
            className="ml-2 text-slate-500 hover:text-white transition text-xs cursor-pointer"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
