"use client";

import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import {
  X,
  Heart,
  Star,
  MapPin,
  Zap,
  ChevronLeft,
  ChevronRight,
  Coffee,
  UtensilsCrossed,
  CalendarDays,
  Sparkles,
  Store,
  Martini,
  IceCreamCone,
  Info,
} from "lucide-react";
import Image from "next/image";
import { useState, useCallback, useRef } from "react";
import { Place } from "@/types";
import { formatDistance, getCategoryAccent, getCategoryLabel, isOpenNow } from "@/lib/utils";
import { getCategoryFallbackImage } from "@/lib/place-images";
import { SupportedCityName } from "@/lib/pune-location";
import { getVisitTimeProfile } from "@/lib/visit-time-model";

interface SwipeVibeModeProps {
  places: Place[];
  onOpenPlace: (place: Place) => void;
  onClose: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  cafe:          <Coffee size={14} />,
  restaurant:    <UtensilsCrossed size={14} />,
  event:         <CalendarDays size={14} />,
  nightlife:     <Sparkles size={14} />,
  "food-stall":  <Store size={14} />,
  bar:           <Martini size={14} />,
  dessert:       <Sparkles size={14} />,
  "ice-cream":   <IceCreamCone size={14} />,
  "street-food": <Store size={14} />,
};

const intensityConfig = {
  quiet:    { color: "text-emerald-300", dot: "bg-emerald-400", label: "Quiet Now" },
  moderate: { color: "text-amber-300",   dot: "bg-amber-400",   label: "Moderate"  },
  busy:     { color: "text-orange-300",  dot: "bg-orange-400",  label: "Busy Now"  },
  peak:     { color: "text-rose-300",    dot: "bg-rose-500",    label: "Peak Hour" },
};

// ─── Save to the dedicated "⚡ Vibe Picks" folder ─────────────────────────────
async function saveToVibePicks(placeId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/saved-places/vibe-picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── SwipeCard (inner, draggable) ─────────────────────────────────────────────
function SwipeCard({
  place,
  onSwipe,
  isTop,
  stackIndex,
}: {
  place: Place;
  onSwipe: (dir: "left" | "right") => void;
  isTop: boolean;
  stackIndex: number;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-22, 0, 22]);
  const likeOpacity = useTransform(x, [20, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, -20], [1, 0]);

  const [imageSrc, setImageSrc] = useState(place.image);
  const open = isOpenNow(place.hours);
  const hasHours = Boolean(place.hours);
  const vtp = getVisitTimeProfile(place);
  const ic = intensityConfig[vtp.currentIntensity];

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.x > 100) onSwipe("right");
      else if (info.offset.x < -100) onSwipe("left");
    },
    [onSwipe]
  );

  const stackScale = 1 - stackIndex * 0.04;
  const stackY = stackIndex * 12;

  if (!isTop) {
    return (
      <motion.div
        style={{ scale: stackScale, y: stackY, zIndex: 10 - stackIndex }}
        className="absolute inset-0 rounded-2xl border border-white/5 bg-slate-900/60 shadow-xl pointer-events-none"
      />
    );
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      style={{ x, rotate, zIndex: 10 }}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: "grabbing" }}
      className="absolute inset-0 cursor-grab touch-none select-none rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-950/90 backdrop-blur-xl flex flex-col"
    >
      {/* Right swipe → Vibe overlay */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute inset-0 z-20 bg-gradient-to-br from-teal-500/40 to-emerald-500/20 rounded-2xl pointer-events-none flex items-center justify-center p-5"
      >
        <span className="rotate-[-12deg] rounded-2xl border-4 border-teal-400 bg-slate-950/80 backdrop-blur-md px-6 py-3 text-3xl font-black uppercase tracking-widest text-teal-300 shadow-[0_0_30px_rgba(45,212,191,0.4)]">
          VIBE ⚡
        </span>
      </motion.div>

      {/* Left swipe → Skip overlay */}
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute inset-0 z-20 bg-gradient-to-bl from-rose-500/40 to-orange-500/20 rounded-2xl pointer-events-none flex items-center justify-center p-5"
      >
        <span className="rotate-[12deg] rounded-2xl border-4 border-rose-400 bg-slate-950/80 backdrop-blur-md px-6 py-3 text-3xl font-black uppercase tracking-widest text-rose-300 shadow-[0_0_30px_rgba(244,63,94,0.4)]">
          SKIP 👋
        </span>
      </motion.div>

      {/* Hero image */}
      <div className="relative h-56 sm:h-64 overflow-hidden bg-slate-900 shrink-0">
        <Image
          src={imageSrc}
          alt={place.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 520px"
          onError={() => {
            const fallback = getCategoryFallbackImage(place.city as SupportedCityName, place.category, place.title);
            if (imageSrc !== fallback) setImageSrc(fallback);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/20" />

        {/* Category badge */}
        <div className="absolute top-4 left-4 z-10">
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${getCategoryAccent(place.category)} px-3 py-1 text-xs font-black text-slate-950 shadow-lg`}>
            {categoryIcons[place.category]}
            {getCategoryLabel(place.category)}
          </span>
        </div>

        {/* Visit time badge */}
        <div className="absolute top-4 right-4 z-10">
          <span className={`flex items-center gap-1.5 rounded-md border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${ic.color} backdrop-blur-md`}>
            <span className={`h-1.5 w-1.5 rounded-full ${ic.dot} animate-pulse`} />
            {ic.label}
          </span>
        </div>

        {/* Rating */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-md">
          <Star size={12} className="fill-yellow-300 text-yellow-300" />
          {place.rating}
          <span className="font-medium text-slate-300">({place.reviewCount})</span>
        </div>

        {/* Open / closed */}
        <div className="absolute bottom-4 right-4">
          {hasHours && (
            <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${open ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30" : "bg-rose-950/80 text-rose-300 border border-rose-500/30"}`}>
              {open ? "Open" : "Closed"}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between min-h-0 bg-gradient-to-b from-slate-950/40 to-slate-950/90 text-left">
        <div className="space-y-2.5 overflow-hidden">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight leading-tight line-clamp-1">{place.title}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <MapPin size={12} className="text-cyan-400 shrink-0" />
              <span className="truncate">{place.locality ?? place.city}</span>
              <span className="ml-auto text-[10px] text-teal-400">{formatDistance(place.distance)} away</span>
            </p>
          </div>

          <p className="text-xs leading-relaxed text-slate-300 line-clamp-3">{place.description}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 pt-2 shrink-0">
          {place.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full border border-white/5 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function SwipeVibeMode({ places, onOpenPlace, onClose }: SwipeVibeModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [vibeCount, setVibeCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [lastAction, setLastAction] = useState<"vibed" | "skipped" | null>(null);
  const [vibedIds] = useState<Set<string>>(() => new Set());
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Show top 3 cards in a stack
  const stackPlaces = places.slice(currentIndex, currentIndex + 3);
  const isDone = currentIndex >= places.length;

  const handleSwipe = useCallback(
    (dir: "left" | "right") => {
      const place = places[currentIndex];
      if (!place) return;

      if (dir === "right") {
        // Save to "⚡ Vibe Picks" folder (fire-and-forget)
        vibedIds.add(place.id);
        void saveToVibePicks(place.id);
        setVibeCount((c) => c + 1);
        setLastAction("vibed");
      } else {
        setSkippedCount((c) => c + 1);
        setLastAction("skipped");
      }

      setCurrentIndex((i) => i + 1);

      // Reset lastAction after animation
      setTimeout(() => setLastAction(null), 600);
    },
    [currentIndex, places, vibedIds]
  );

  const handleButtonLeft = () => handleSwipe("left");
  const handleButtonRight = () => handleSwipe("right");

  const progress = places.length > 0 ? Math.round((currentIndex / places.length) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="dark fixed inset-0 z-[9998] flex flex-col bg-[#05080c] backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95"
        >
          <ChevronLeft size={15} />
          Back
        </button>

        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-widest text-teal-400">
            <Zap size={12} className="inline mr-1" />
            Swipe &amp; Vibe
          </p>
          <p className="text-[10px] font-semibold text-slate-400">
            {isDone ? "All done!" : `${places.length - currentIndex} left`}
          </p>
        </div>

        {/* Live counter */}
        <div className="flex items-center gap-3 text-xs font-black">
          <span className="flex items-center gap-1 text-rose-400">
            <X size={12} /> {skippedCount}
          </span>
          <span className="flex items-center gap-1 text-teal-400">
            <Zap size={12} /> {vibeCount}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-5 h-1 rounded-full bg-slate-800 shrink-0">
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400"
        />
      </div>

      {/* Card stack */}
      <div className="flex-1 flex items-center justify-center p-5 overflow-hidden" ref={constraintsRef}>
        {isDone ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4 px-6"
          >
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-black text-white">That&apos;s a wrap!</h2>
            <p className="text-sm font-semibold text-slate-300 leading-relaxed">
              You swiped through <span className="text-teal-300 font-black">{places.length}</span> places
              and vibed with <span className="text-teal-300 font-black">{vibeCount}</span>.
            </p>
            <p className="text-xs font-semibold text-slate-400">
              Your picks are saved in your <span className="text-teal-400 font-black">⚡ Vibe Picks</span> folder.
            </p>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-400 active:scale-95"
            >
              Back to Discover <ChevronRight size={16} />
            </button>
          </motion.div>
        ) : (
          <div className="relative w-full max-w-sm" style={{ height: 480 }}>
            <AnimatePresence>
              {stackPlaces
                .map((place, i) => ({ place, i }))
                .reverse()
                .map(({ place, i }) => (
                  <SwipeCard
                    key={`${currentIndex + i}-${place.id}`}
                    place={place}
                    isTop={i === 0}
                    stackIndex={i}
                    onSwipe={handleSwipe}
                  />
                ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!isDone && (
        <div className="flex items-center justify-center gap-8 pb-8 shrink-0">
          {/* Skip */}
          <motion.button
            onClick={handleButtonLeft}
            whileTap={{ scale: 0.88 }}
            animate={lastAction === "skipped" ? { scale: [1, 1.2, 1] } : {}}
            className="grid h-16 w-16 place-items-center rounded-full border-2 border-rose-500/40 bg-rose-500/10 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)] transition duration-200 hover:bg-rose-500/20 hover:border-rose-500/60 hover:shadow-[0_0_25px_rgba(244,63,94,0.3)]"
          >
            <X size={28} strokeWidth={2.5} />
          </motion.button>

          {/* Info / Details */}
          <button
            onClick={() => {
              const place = places[currentIndex];
              if (place) onOpenPlace(place);
            }}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition duration-200 hover:bg-white/10 hover:border-white/20 hover:text-white"
            title="View details"
          >
            <Info size={16} />
          </button>

          {/* Vibe (right swipe) */}
          <motion.button
            onClick={handleButtonRight}
            whileTap={{ scale: 0.88 }}
            animate={lastAction === "vibed" ? { scale: [1, 1.3, 1] } : {}}
            className="grid h-16 w-16 place-items-center rounded-full border-2 border-teal-500/40 bg-teal-500/10 text-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.15)] transition duration-200 hover:bg-teal-500/20 hover:border-teal-500/60 hover:shadow-[0_0_25px_rgba(45,212,191,0.3)]"
          >
            <Zap size={28} strokeWidth={2.5} />
          </motion.button>
        </div>
      )}

      {/* Bottom hint */}
      {!isDone && (
        <p className="pb-5 text-center text-[10px] font-semibold text-slate-400 shrink-0">
          Drag left to skip · Drag right to vibe · Tap Info for details
        </p>
      )}
    </motion.div>
  );
}
