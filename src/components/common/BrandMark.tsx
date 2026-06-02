"use client";

import { MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: {
    mark: "h-8 w-8 rounded-xl",
    pin: 10,
    sparkle: 8,
    letter: "text-sm",
    text: "text-xs tracking-[0.16em]",
  },
  md: {
    mark: "h-9 w-9 rounded-xl",
    pin: 11,
    sparkle: 9,
    letter: "text-base",
    text: "text-sm tracking-[0.18em]",
  },
  lg: {
    mark: "h-11 w-11 rounded-2xl",
    pin: 13,
    sparkle: 10,
    letter: "text-lg",
    text: "text-base tracking-[0.18em]",
  },
};

export const BrandMark: React.FC<BrandMarkProps> = ({ size = "md", showWordmark = true, className }) => {
  const styles = sizeClasses[size];

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5 text-[var(--foreground)]", className)}>
      <span
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden border border-white/20 bg-[#071013] text-white shadow-lg shadow-cyan-500/20",
          styles.mark
        )}
        aria-hidden
      >
        <span className="absolute inset-0 bg-[conic-gradient(from_220deg,#22d3ee,#a3e635,#f97316,#ec4899,#22d3ee)]" />
        <span className="absolute inset-[2px] rounded-[inherit] bg-[#071013]/92" />
        <span className="absolute inset-x-2 top-1 h-px bg-white/35" />
        <span className={cn("relative font-black leading-none text-white", styles.letter)}>
          S
        </span>
        <MapPin
          size={styles.pin}
          className="absolute bottom-1.5 right-1.5 text-cyan-200"
          strokeWidth={3}
        />
        <Sparkles
          size={styles.sparkle}
          className="absolute left-1.5 top-1.5 text-lime-200"
          strokeWidth={3}
        />
      </span>
      {showWordmark && (
        <span className={cn("truncate font-black uppercase leading-none text-[var(--foreground)]", styles.text)}>
          Sheher
        </span>
      )}
    </span>
  );
};
