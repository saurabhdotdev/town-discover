"use client";

import { motion } from "framer-motion";
import {
  Bookmark,
  CalendarDays,
  Clock,
  Coffee,
  ExternalLink,
  Flame,
  MapPin,
  Martini,
  Share2,
  Sparkles,
  Star,
  Store,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { CrowdLevel, CrowdSummary, Place, PlaceCategory } from "@/types";
import { formatDistance, formatHours, getCategoryAccent, getCategoryLabel, isOpenNow } from "@/lib/utils";
import Image from "next/image";
import { useState } from "react";

interface DiscoveryCardProps {
  place: Place;
  index?: number;
  onClick?: () => void;
  onSave?: (place: Place) => void;
  isSaved?: boolean;
  crowdSummary?: CrowdSummary;
}

const categoryIcons: Record<PlaceCategory, React.ReactNode> = {
  cafe: <Coffee size={15} />,
  restaurant: <UtensilsCrossed size={15} />,
  event: <CalendarDays size={15} />,
  nightlife: <Sparkles size={15} />,
  "food-stall": <Store size={15} />,
  bar: <Martini size={15} />,
  dessert: <Sparkles size={15} />,
  "street-food": <Store size={15} />,
};

const crowdLabels: Record<CrowdLevel, string> = {
  low: "Not crowded",
  moderate: "Moderate",
  busy: "Crowded",
  very_crowded: "Very crowded",
};

const crowdStyles: Record<CrowdLevel, string> = {
  low: "bg-emerald-300 text-slate-950",
  moderate: "bg-cyan-300 text-slate-950",
  busy: "bg-amber-300 text-slate-950",
  very_crowded: "bg-rose-500 text-white",
};

export const DiscoveryCard: React.FC<DiscoveryCardProps> = ({
  place,
  index = 0,
  onClick,
  onSave,
  isSaved = false,
  crowdSummary,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const open = isOpenNow(place.hours);
  const hasCrowdSignal = Boolean(crowdSummary?.crowdLevel && crowdSummary.reportCount > 0);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const shareData = {
      title: place.title,
      text: `${place.title} in ${place.locality} - ${place.description}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard?.writeText(`${shareData.text} ${shareData.url}`);
    } catch {
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(`${place.title} ${place.city}`)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.42,
        delay: index * 0.04,
        ease: "easeOut",
      }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      className="h-full"
    >
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={handleKeyDown}
        onClick={onClick}
        className="group flex h-full min-h-[360px] cursor-pointer flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-2xl shadow-black/10 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-[var(--muted)] hover:bg-[var(--panel-strong)] sm:min-h-[420px]"
      >
        <div className="relative h-44 overflow-hidden bg-slate-900 sm:h-52">
          <Image
            src={place.image}
            alt={`${place.title} in ${place.locality}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={`object-cover transition duration-700 group-hover:scale-105 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
          />
          {!imageLoaded && <div className="absolute inset-0 animate-pulse bg-slate-800" />}

          <div className="absolute inset-0 bg-gradient-to-t from-[#080b0f] via-[#080b0f]/16 to-transparent" />

          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 sm:gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${getCategoryAccent(
                place.category
              )} px-2 py-1 text-[11px] font-black text-slate-950 shadow-lg sm:px-2.5 sm:text-xs`}
            >
              {categoryIcons[place.category]}
              {getCategoryLabel(place.category)}
            </span>
            {place.isTrending && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-2 py-1 text-[11px] font-black text-white shadow-lg sm:px-2.5 sm:text-xs">
                <Flame size={14} />
                Trending
              </span>
            )}
            {hasCrowdSignal && crowdSummary?.crowdLevel && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-black shadow-lg sm:px-2.5 sm:text-xs ${crowdStyles[crowdSummary.crowdLevel]}`}>
                <Users size={14} />
                {crowdLabels[crowdSummary.crowdLevel]}
              </span>
            )}
          </div>

          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-sm font-bold text-white backdrop-blur-md">
            <Star size={14} className="fill-yellow-300 text-yellow-300" />
            {place.rating}
            <span className="font-medium text-slate-300">({place.reviewCount})</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-lg font-black leading-tight text-[var(--foreground)]">{place.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted)]">
              <MapPin size={14} className="shrink-0 text-cyan-300" />
              <span className="truncate">
                {place.locality} - {formatDistance(place.distance)}
              </span>
            </p>
          </div>

          <p className="line-clamp-2 text-sm leading-5 text-[var(--muted-strong)] sm:leading-6">{place.description}</p>

          <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-[var(--muted-strong)]">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-2">
              <div className="mb-1 flex items-center gap-1.5 text-[var(--muted)]">
                <Clock size={13} />
                Hours
              </div>
              <div className={open ? "text-emerald-300" : "text-rose-300"}>
                {open ? "Open now" : "Closed"}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-2">
              <div className="mb-1 flex items-center gap-1.5 text-[var(--muted)]">
                <Users size={13} />
                Crowd
              </div>
              {hasCrowdSignal && crowdSummary?.crowdLevel ? (
                <div className="text-[var(--foreground)]" title="Average active crowd reports">
                  {crowdLabels[crowdSummary.crowdLevel]} - avg of {crowdSummary.reportCount}
                </div>
              ) : (
                <div className="text-[var(--muted)]">No live report</div>
              )}
            </div>
          </div>

          <p className="line-clamp-1 text-xs text-[var(--muted)]">{formatHours(place.hours)}</p>

          <div className="mt-auto flex flex-wrap gap-1.5">
            {place.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-1 text-xs font-semibold text-[var(--muted-strong)]"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-2 pt-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClick?.();
              }}
              className="inline-flex min-w-0 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-black text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              Details
              <ExternalLink size={15} />
            </button>
            <button
              type="button"
              aria-label={`Share ${place.title}`}
              onClick={handleShare}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] transition hover:bg-[var(--panel)]"
            >
              <Share2 size={16} />
            </button>
            <button
              type="button"
              aria-label={isSaved ? `Remove ${place.title} from saved places` : `Save ${place.title}`}
              onClick={(event) => {
                event.stopPropagation();
                onSave?.(place);
              }}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] transition hover:bg-[var(--panel)]"
            >
              <Bookmark size={16} className={isSaved ? "fill-amber-300 text-amber-300" : ""} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
