"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Sparkles,
  Coffee,
  UtensilsCrossed,
  Star,
  Flame,
  Clock,
  Navigation,
  X,
  IceCreamCone,
  Store,
  Mic,
  TrendingUp,
} from "lucide-react";
import { Place } from "@/types";
import { formatDistance, getCategoryLabel } from "@/lib/utils";

interface SmartSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  places: Place[];
  placeholder?: string;
  onSelectPlace?: (place: Place) => void;
  className?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  cafe: <Coffee size={13} />,
  restaurant: <UtensilsCrossed size={13} />,
  "ice-cream": <IceCreamCone size={13} />,
  dessert: <IceCreamCone size={13} />,
  "street-food": <Store size={13} />,
  "food-stall": <Store size={13} />,
  event: <Sparkles size={13} />,
  bar: <Flame size={13} />,
  nightlife: <Flame size={13} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  cafe: "text-amber-400 bg-amber-500/15 border-amber-500/25",
  restaurant: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
  "ice-cream": "text-pink-400 bg-pink-500/15 border-pink-500/25",
  dessert: "text-pink-400 bg-pink-500/15 border-pink-500/25",
  "street-food": "text-orange-400 bg-orange-500/15 border-orange-500/25",
  "food-stall": "text-orange-400 bg-orange-500/15 border-orange-500/25",
  event: "text-purple-400 bg-purple-500/15 border-purple-500/25",
  bar: "text-rose-400 bg-rose-500/15 border-rose-500/25",
  nightlife: "text-rose-400 bg-rose-500/15 border-rose-500/25",
};

const QUICK_SEARCHES = [
  { label: "Trending spots", icon: <TrendingUp size={12} />, query: "trending" },
  { label: "Open now", icon: <Clock size={12} />, query: "open" },
  { label: "Cafes", icon: <Coffee size={12} />, query: "cafe" },
  { label: "Street food", icon: <Store size={12} />, query: "street food" },
  { label: "Events", icon: <Sparkles size={12} />, query: "event" },
];

export function SmartSearchBar({
  value,
  onChange,
  places,
  placeholder,
  onSelectPlace,
  className = "",
}: SmartSearchBarProps) {
  const [focused, setFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase();
    return places
      .filter((p) => {
        return (
          p.title.toLowerCase().includes(q) ||
          p.locality?.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // Prioritize title match, then trending, then rating
        const aTitle = a.title.toLowerCase().startsWith(q) ? 1 : 0;
        const bTitle = b.title.toLowerCase().startsWith(q) ? 1 : 0;
        if (bTitle !== aTitle) return bTitle - aTitle;
        if (b.isTrending !== a.isTrending) return b.isTrending ? 1 : -1;
        return b.rating - a.rating;
      })
      .slice(0, 7);
  }, [value, places]);

  const showDropdown = focused;

  const handleSelect = useCallback(
    (place: Place) => {
      onChange(place.title);
      setFocused(false);
      onSelectPlace?.(place);
    },
    [onChange, onSelectPlace]
  );

  const handleQuickSearch = (query: string) => {
    onChange(query);
    setFocused(true);
    inputRef.current?.focus();
  };

  const getCategoryColor = (cat: string) =>
    CATEGORY_COLORS[cat] || "text-teal-400 bg-teal-500/15 border-teal-500/25";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search input */}
      <label className="relative block">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] transition-colors duration-200"
          size={18}
          style={{ color: focused ? "rgb(45, 212, 191)" : undefined }}
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setHasInteracted(true);
          }}
          onFocus={() => {
            setFocused(true);
            setHasInteracted(true);
          }}
          placeholder={placeholder || "Search cafes, food, events…"}
          className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] pl-11 pr-10 text-sm font-semibold text-[var(--foreground)] outline-none transition-all duration-200 placeholder:text-[var(--muted)] focus:border-teal-400/70 focus:shadow-[0_0_0_3px_rgba(45,212,191,0.12)] sm:h-14 sm:pl-12"
          style={{
            boxShadow: focused ? "0 0 0 3px rgba(45,212,191,0.12)" : undefined,
          }}
          autoComplete="off"
          spellCheck={false}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--panel-soft)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X size={13} />
          </button>
        )}
        {!value && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted)] hover:text-teal-400 hover:border-teal-400/40 transition-all"
            title="Voice search (coming soon)"
          >
            <Mic size={13} />
          </button>
        )}
      </label>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-[9998] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl shadow-black/30 backdrop-blur-xl"
          >
            {/* Quick searches (when no query) */}
            {!value.trim() && (
              <div className="p-3">
                <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                  Quick Searches
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SEARCHES.map((qs) => (
                    <button
                      key={qs.query}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleQuickSearch(qs.query);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-bold text-[var(--muted-strong)] transition hover:border-teal-400/40 hover:bg-teal-500/10 hover:text-teal-300"
                    >
                      {qs.icon}
                      {qs.label}
                    </button>
                  ))}
                </div>

                {places.length > 0 && (
                  <div className="mt-3 border-t border-[var(--border)] pt-3">
                    <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                      Trending Now
                    </p>
                    <div className="space-y-0.5">
                      {places
                        .filter((p) => p.isTrending)
                        .slice(0, 3)
                        .map((place) => (
                          <SuggestionRow
                            key={place.id}
                            place={place}
                            query=""
                            onSelect={handleSelect}
                            getCategoryColor={getCategoryColor}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Filtered suggestions */}
            {value.trim() && suggestions.length > 0 && (
              <div className="p-2">
                <p className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                  {suggestions.length} result{suggestions.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-0.5">
                  {suggestions.map((place) => (
                    <SuggestionRow
                      key={place.id}
                      place={place}
                      query={value}
                      onSelect={handleSelect}
                      getCategoryColor={getCategoryColor}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {value.trim() && suggestions.length === 0 && (
              <div className="p-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-soft)]">
                  <Search size={20} className="text-[var(--muted)] opacity-40" />
                </div>
                <p className="text-sm font-bold text-[var(--foreground)]">
                  No places found
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Nothing matches &ldquo;<span className="font-bold text-teal-400">{value}</span>&rdquo;
                </p>
                <p className="mt-1.5 text-[10px] text-[var(--muted)] opacity-70 leading-relaxed">
                  Try a different spelling, area name, or category
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {QUICK_SEARCHES.map((qs) => (
                    <button
                      key={qs.query}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleQuickSearch(qs.query);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted-strong)] transition hover:border-teal-400/40 hover:bg-teal-500/10 hover:text-teal-300"
                    >
                      {qs.icon}
                      {qs.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Footer tip */}
            <div className="border-t border-[var(--border)] px-4 py-2.5 flex items-center gap-2">
              <Sparkles size={10} className="text-teal-400 opacity-70" />
              <p className="text-[10px] text-[var(--muted)] opacity-60">
                Showing places from live OSM + curated data
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SuggestionRowProps {
  place: Place;
  query: string;
  onSelect: (place: Place) => void;
  getCategoryColor: (cat: string) => string;
}

function SuggestionRow({ place, query, onSelect, getCategoryColor }: SuggestionRowProps) {
  const highlightText = (text: string, q: string) => {
    if (!q) return <span>{text}</span>;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, idx)}
        <mark className="bg-teal-400/20 text-teal-200 rounded-sm font-black not-italic">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </span>
    );
  };

  const catColor = getCategoryColor(place.category);
  const categoryIcon = CATEGORY_ICONS[place.category] || <MapPin size={13} />;

  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(place);
      }}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-[var(--panel-soft)]"
    >
      {/* Category icon badge */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs ${catColor}`}
      >
        {categoryIcon}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[var(--foreground)] group-hover:text-teal-300 transition-colors">
          {highlightText(place.title, query)}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="flex items-center gap-0.5 text-[10px] text-[var(--muted)]">
            <MapPin size={9} />
            {place.locality || place.city}
          </span>
          {place.distance > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-teal-400/80">
              <Navigation size={9} />
              {formatDistance(place.distance)}
            </span>
          )}
        </div>
      </div>

      {/* Right side: rating + trending + open */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {place.rating > 0 && (
          <span className="flex items-center gap-0.5 text-[11px] font-black text-amber-400">
            <Star size={9} className="fill-amber-400" />
            {place.rating}
          </span>
        )}
        {place.isTrending && (
          <span className="flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-rose-400 border border-rose-500/20">
            <Flame size={7} className="fill-rose-400" />
            Hot
          </span>
        )}
        {place.isOpen && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
        )}
      </div>
    </button>
  );
}
