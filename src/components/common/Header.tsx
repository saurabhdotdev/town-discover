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
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  location,
  showLocation = true,
  eyebrow,
  className,
}) => {
  return (
    <motion.header
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
      className={cn(
        "sticky top-14 z-30 border-b border-[var(--border)] bg-[var(--nav)] backdrop-blur-xl md:top-16",
        className
      )}
    >
      <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-3 py-3 sm:px-4 md:flex-row md:items-end md:justify-between md:px-6 md:py-5">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fresh)]">
              <Radio size={13} />
              {eyebrow}
            </div>
          )}
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark size="lg" showWordmark={false} />
            <h1 className="truncate text-xl font-black tracking-tight text-[var(--foreground)] sm:text-2xl md:text-3xl">
              {title}
            </h1>
          </div>
          {subtitle && <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-5 text-[var(--muted)] md:text-base md:leading-6">{subtitle}</p>}
        </div>

        {showLocation && location && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, delay: 0.08 }}
            className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-strong)] sm:py-2 sm:text-sm"
          >
            <LocateFixed size={16} className="shrink-0 text-[var(--brand)]" />
            <span className="truncate">{location}</span>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
};
