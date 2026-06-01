"use client";

import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: {
    mark: "h-8 w-8 rounded-lg",
    icon: 15,
    text: "text-xs tracking-[0.16em]",
  },
  md: {
    mark: "h-9 w-9 rounded-lg",
    icon: 17,
    text: "text-sm tracking-[0.18em]",
  },
  lg: {
    mark: "h-11 w-11 rounded-lg",
    icon: 20,
    text: "text-base tracking-[0.18em]",
  },
};

export const BrandMark: React.FC<BrandMarkProps> = ({ size = "md", showWordmark = true, className }) => {
  const styles = sizeClasses[size];

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5 text-[var(--foreground)]", className)}>
      <span
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden border border-white/20 bg-[#071013] text-white shadow-lg shadow-teal-500/20",
          styles.mark
        )}
        aria-hidden
      >
        <span className="absolute inset-0 bg-[linear-gradient(135deg,#22d3ee_0%,#14b8a6_46%,#f59e0b_100%)] opacity-95" />
        <span className="absolute inset-[3px] rounded-[inherit] bg-[#071013]/88" />
        <MapPin size={styles.icon} className="relative text-teal-200" strokeWidth={2.8} />
      </span>
      {showWordmark && (
        <span className={cn("truncate font-black uppercase leading-none", styles.text)}>
          Sheher
        </span>
      )}
    </span>
  );
};
