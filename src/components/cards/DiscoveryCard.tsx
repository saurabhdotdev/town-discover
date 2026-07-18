"use client";

import { motion } from "framer-motion";
import {
  Bookmark,
  CalendarDays,
  Clock,
  Coffee,
  ExternalLink,
  Flame,
  IceCreamCone,
  MapPin,
  Martini,
  Share2,
  Sparkles,
  Star,
  Store,
  UtensilsCrossed,
  Users,
  Train,
  Globe,
  Dog,
} from "lucide-react";
import { CrowdLevel, CrowdSummary, Place, PlaceCategory } from "@/types";
import { getCategoryFallbackImage } from "@/lib/place-images";
import { SupportedCityName } from "@/lib/pune-location";
import { API_URL, formatDistance, formatHours, formatPlaceArea, getCategoryAccent, getCategoryLabel, isOpenNow, isVegetarianPlace } from "@/lib/utils";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useCrowdSocket } from "@/hooks/useCrowdSocket";
import { getVisitTimeProfile } from "@/lib/visit-time-model";


interface DiscoveryCardProps {
  place: Place;
  index?: number;
  onClick?: () => void;
  onSave?: (place: Place) => void;
  isSaved?: boolean;
  crowdSummary?: CrowdSummary;
  vibeMatch?: number;
}

const categoryIcons: Record<PlaceCategory, React.ReactNode> = {
  cafe: <Coffee size={15} />,
  restaurant: <UtensilsCrossed size={15} />,
  event: <CalendarDays size={15} />,
  nightlife: <Sparkles size={15} />,
  "food-stall": <Store size={15} />,
  bar: <Martini size={15} />,
  dessert: <Sparkles size={15} />,
  "ice-cream": <IceCreamCone size={15} />,
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
  vibeMatch,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState(place.image);
  const [localCrowdSummary, setLocalCrowdSummary] = useState<CrowdSummary | undefined>(crowdSummary);

  useEffect(() => {
    setTimeout(() => {
      setLocalCrowdSummary(crowdSummary);
    }, 0);
  }, [crowdSummary]);

  const handleCrowdUpdate = useCallback(
    (summary: CrowdSummary) => setLocalCrowdSummary(summary),
    []
  );
  useCrowdSocket(place.id, handleCrowdUpdate);

  useEffect(() => {
    setTimeout(() => {
      setImageSrc(place.image);
      setImageLoaded(false);
    }, 0);

    const params = new URLSearchParams({
      placeId: place.id,
      title: place.title,
      city: place.city,
      category: place.category,
    });

    fetch(`/api/places/image?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { image?: string } | null) => {
        if (data?.image) {
          const imageUrl = data.image;
          setImageSrc((prev) => {
            if (prev !== imageUrl) {
              setImageLoaded(false);
              return imageUrl;
            }
            return prev;
          });
        }
      })
      .catch(() => undefined);
  }, [place.category, place.city, place.id, place.image, place.title]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
  };

  const open = isOpenNow(place.hours);
  const hasHours = Boolean(place.hours);
  const hasCrowdSignal = Boolean(localCrowdSummary?.crowdLevel && localCrowdSummary.reportCount > 0);
  const areaLabel = formatPlaceArea(place);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const shareData = {
      title: place.title,
      text: `${place.title} in ${areaLabel} - ${place.description}`,
      url: window.location.href,
    };
    const exactSearchQuery = `${place.title} ${areaLabel} ${getCategoryLabel(place.category)} outlet`;

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard?.writeText(`${shareData.text} ${shareData.url}`);
    } catch {
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(exactSearchQuery)}`,
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
        onMouseMove={handleMouseMove}
        className={`group card-spotlight-border glow-${place.category} flex h-full min-h-[330px] cursor-pointer flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-xl shadow-black/10 backdrop-blur-md transition duration-300 hover:border-teal-500/40 hover:bg-[var(--panel-strong)] sm:min-h-[420px] sm:hover:-translate-y-1.5`}
      >
        <div className="relative h-40 overflow-hidden bg-slate-900 sm:h-52">
          <Image
            src={imageSrc}
            alt={`${place.title} in ${place.locality}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAmEB9xG7d6sAAAAASUVORK5CYII="
            className={`object-cover transition duration-700 group-hover:scale-105 ${imageLoaded ? "opacity-100" : "opacity-0"
              }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              const fallback = getCategoryFallbackImage(place.city as SupportedCityName, place.category, place.title);
              if (imageSrc !== fallback) {
                setImageSrc(fallback);
                setImageLoaded(false);
              }
            }}
          />
          {!imageLoaded && <div className="absolute inset-0 animate-pulse bg-slate-800" />}

          <div className="absolute inset-0 bg-gradient-to-t from-[#080b0f] via-[#080b0f]/16 to-transparent" />

          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 sm:gap-2 z-10">
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
            {hasCrowdSignal && localCrowdSummary?.crowdLevel && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-black shadow-lg sm:px-2.5 sm:text-xs ${crowdStyles[localCrowdSummary.crowdLevel]}`}>
                <Users size={14} />
                {crowdLabels[localCrowdSummary.crowdLevel]}
              </span>
            )}
            {vibeMatch && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/90 border border-teal-500/30 pl-1.5 pr-2.5 py-1 text-[11px] font-black text-white shadow-lg sm:text-xs backdrop-blur-md">
                <svg className="h-4 w-4 shrink-0 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(20, 184, 166, 0.2)" strokeWidth="4" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="url(#vibe-grad)"
                    strokeWidth="4"
                    strokeDasharray="94.2"
                    strokeDashoffset={94.2 - (94.2 * vibeMatch) / 100}
                    strokeLinecap="round"
                    className="vibe-ring-progress"
                  />
                  <defs>
                    <linearGradient id="vibe-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2dd4bf" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <span>{vibeMatch}% Match</span>
              </span>
            )}
          </div>

          {/* Visit Time Intensity Badge */}
          {(() => {
            const profile = getVisitTimeProfile(place);
            const config = {
              quiet:    { dot: "bg-emerald-400", text: "text-emerald-300", label: "Quiet Now",    border: "border-emerald-500/30", bg: "bg-emerald-950/80" },
              moderate: { dot: "bg-amber-400",   text: "text-amber-300",   label: "Moderate",     border: "border-amber-500/30",   bg: "bg-amber-950/80" },
              busy:     { dot: "bg-orange-400",  text: "text-orange-300",  label: "Getting Busy", border: "border-orange-500/30",  bg: "bg-orange-950/80" },
              peak:     { dot: "bg-rose-500",    text: "text-rose-300",    label: "Peak Hours",   border: "border-rose-500/30",    bg: "bg-rose-950/80" },
            }[profile.currentIntensity];
            return (
              <div className={`absolute top-3 right-3 flex items-center gap-1.5 rounded-md border ${config.border} ${config.bg} px-2 py-1 text-[10px] font-black uppercase tracking-wider ${config.text} backdrop-blur-md z-10`}>
                <span className={`h-1.5 w-1.5 rounded-full ${config.dot} animate-pulse shrink-0`} />
                {config.label}
              </div>
            );
          })()}


          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-sm font-bold text-white backdrop-blur-md">
            <Star size={14} className="fill-yellow-300 text-yellow-300" />
            {place.rating}
            <span className="font-medium text-slate-300">({place.reviewCount})</span>
          </div>

          {isVegetarianPlace(place) && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-950/80 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 backdrop-blur-md">
              {/* Indian Veg Mark: Green dot inside green square */}
              <span className="flex h-3 w-3 shrink-0 items-center justify-center border border-emerald-500 rounded bg-transparent p-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span>Pure Veg</span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-black leading-tight text-[var(--foreground)] sm:text-lg">{place.title}</h3>
            <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold leading-5 text-[var(--muted-strong)]">
              <MapPin size={14} className="mt-0.5 shrink-0 text-cyan-300" />
              <span className="line-clamp-2">
                {areaLabel}
              </span>
            </p>
            <p className="mt-0.5 pl-5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              {formatDistance(place.distance)} away
            </p>
          </div>

          <p className="line-clamp-2 text-sm leading-5 text-[var(--muted-strong)] sm:leading-6">{place.description}</p>

          <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-[var(--muted-strong)]">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-2">
              <div className="mb-1 flex items-center gap-1.5 text-[var(--muted)]">
                <Clock size={13} />
                Hours
              </div>
              <div className={hasHours ? (open ? "text-emerald-300" : "text-rose-300") : "text-[var(--muted)]"}>
                {!hasHours ? "Hours unknown" : open ? "Open now" : "Closed"}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-2">
              <div className="mb-1 flex items-center gap-1.5 text-[var(--muted)]">
                <Users size={13} />
                Crowd
              </div>
              {hasCrowdSignal && localCrowdSummary?.crowdLevel ? (
                <div className="text-[var(--foreground)]" title="Average active crowd reports">
                  {crowdLabels[localCrowdSummary.crowdLevel]} - avg of {localCrowdSummary.reportCount}
                </div>
              ) : (
                <div className="text-[var(--muted)]">No live report</div>
              )}
            </div>
          </div>

          <p className="hidden text-xs text-[var(--muted)] sm:line-clamp-1">{formatHours(place.hours)}</p>

          <div className="mt-auto flex flex-wrap gap-1.5">
            {place.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-1 text-xs font-semibold flex items-center gap-1 text-[var(--muted-strong)]"
              >
                {tag === "metro-access" ? <Train size={12} /> : null}
                {tag === "foreigner-friendly" ? <Globe size={12} /> : null}
                {tag === "pet-friendly" ? <Dog size={12} /> : null}
                {tag}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            {/* Primary action - full width */}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClick?.();
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2.5 text-sm font-black text-[var(--primary-foreground)] transition hover:opacity-90 active:scale-95"
            >
              Details
              <ExternalLink size={15} />
            </button>
            {/* Secondary actions row */}
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(place.title + ' ' + place.city)}`;
                  window.open(url, '_blank');
                }}
                title="Search on YouTube"
                className="grid h-10 w-full place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] transition hover:bg-[var(--panel)] active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                  <polygon points="10 15 15 12 10 9" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  const tag = encodeURIComponent(place.title.replace(/\s+/g, ''));
                  const url = `https://www.instagram.com/explore/tags/${tag}`;
                  window.open(url, '_blank');
                }}
                title="Search on Instagram"
                className="grid h-10 w-full place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] transition hover:bg-[var(--panel)] active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </button>
              <button
                type="button"
                aria-label={`Share ${place.title}`}
                onClick={handleShare}
                className="grid h-10 w-full place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] transition hover:bg-[var(--panel)] active:scale-95"
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
                className="grid h-10 w-full place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted-strong)] transition hover:bg-[var(--panel)] active:scale-95"
              >
                <Bookmark size={16} className={isSaved ? "fill-amber-300 text-amber-300" : ""} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
