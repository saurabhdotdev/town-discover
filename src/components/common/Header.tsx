"use client";

import { motion } from "framer-motion";
import { LocateFixed, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "./BrandMark";

interface HeaderProps {
  title: string;
  subtitle?: string;
  location?: string;
  showLocation?: boolean;
  eyebrow?: string;
  className?: string;
  compact?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  location,
  showLocation = true,
  eyebrow,
  className,
  compact = false,
}) => {
  return (
    <header
      className={cn(
        "relative z-40 border-b border-[var(--border)] bg-[var(--background)] mt-14 md:mt-0 md:sticky md:top-16 md:backdrop-blur-xl",
        compact ? "py-1.5 md:py-2" : "",
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: "easeOut" }}
        className={cn(
          "mx-auto flex flex-col gap-3 px-3 sm:px-4 md:flex-row md:items-end md:justify-between md:px-6",
          compact
            ? "max-w-full py-1.5 sm:py-2 md:py-2.5 md:items-center gap-1.5"
            : "max-w-screen-xl py-3 md:py-5"
        )}
      >
        <div className="min-w-0 flex flex-col gap-2">
          {eyebrow && !compact && (
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fresh)]">
              <Radio size={13} />
              {eyebrow}
            </div>
          )}
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <BrandMark size={compact ? "sm" : "lg"} showWordmark={false} />
            <h1 className={cn(
              "truncate font-black tracking-tight text-[var(--foreground)]",
              compact ? "text-lg md:text-xl" : "text-xl sm:text-2xl md:text-3xl"
            )}>
              {title}
            </h1>
            {compact && eyebrow && (
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--fresh)]">
                {eyebrow}
              </span>
            )}
          </div>
          {subtitle && !compact && <p className="line-clamp-2 max-w-2xl text-sm leading-5 text-[var(--muted)] md:text-base md:leading-6">{subtitle}</p>}
        </div>

        {showLocation && location && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, delay: 0.08 }}
            className={cn(
              "inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)]",
              compact ? "sm:py-1 text-[11px]" : "sm:py-2 sm:text-sm"
            )}
          >
            <LocateFixed size={compact ? 13 : 16} className="shrink-0 text-[var(--brand)]" />
            <span className="truncate">{location}</span>
          </motion.div>
        )}
      </motion.div>
    </header>
  );
};
