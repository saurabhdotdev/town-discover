"use client";

import { motion } from "framer-motion";

interface XPProgressBarProps {
  totalXp: number;
  level: number;
  title: string;
  progress: number; // 0-100
  xpForLevel: number;
  xpForNext: number;
}

const levelGradients: Record<number, string> = {
  1: "from-slate-400 to-slate-300",
  2: "from-teal-400 to-cyan-300",
  3: "from-cyan-400 to-blue-400",
  4: "from-blue-400 to-violet-400",
  5: "from-violet-400 to-fuchsia-400",
  6: "from-fuchsia-400 to-pink-400",
  7: "from-amber-400 to-orange-400",
  8: "from-yellow-300 to-amber-400",
};

export const XPProgressBar: React.FC<XPProgressBarProps> = ({
  totalXp,
  level,
  title,
  progress,
  xpForLevel,
  xpForNext,
}) => {
  const gradient = levelGradients[level] ?? levelGradients[8];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">Explorer Rank</p>
          <h3 className="mt-0.5 text-lg font-black text-[var(--foreground)]">
            Level {level}{" "}
            <span className={`bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
              — {title}
            </span>
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-black text-[var(--foreground)]">{totalXp.toLocaleString()}</p>
          <p className="text-xs font-bold text-[var(--muted)]">Total XP</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-[var(--panel)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className={`h-full rounded-full bg-gradient-to-r ${gradient} shadow-lg`}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-[var(--muted)]">
        <span>{xpForLevel.toLocaleString()} XP</span>
        <span>{progress}% to Level {level + 1}</span>
        <span>{xpForNext.toLocaleString()} XP</span>
      </div>
    </div>
  );
};
