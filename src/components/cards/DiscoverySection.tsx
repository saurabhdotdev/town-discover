"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Compass, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CrowdSummary, Place } from "@/types";
import { DiscoveryCard } from "./DiscoveryCard";
import { DiscoverySectionSkeleton } from "@/components/common/Skeleton";
import { API_URL } from "@/lib/utils";

const crowdSummaryUpdatedEvent = "sheher:crowd-summary-updated";

interface DiscoverySectionProps {
  title: string;
  description?: string;
  places: Place[];
  loading?: boolean;
  onPlaceClick?: (place: Place) => void;
  onSavePlace?: (place: Place) => void;
  savedPlaceIds?: Set<string>;
  carousel?: boolean;
  vibeScores?: Record<string, number>;
}

export const DiscoverySection: React.FC<DiscoverySectionProps> = ({
  title,
  description,
  places,
  loading = false,
  onPlaceClick,
  onSavePlace,
  savedPlaceIds,
  carousel = false,
  vibeScores,
}) => {
  const [crowdSummaries, setCrowdSummaries] = useState<Record<string, CrowdSummary>>({});
  const placeIds = useMemo(() => places.map((place) => place.id).join(","), [places]);

  useEffect(() => {
    if (!placeIds) {
      return;
    }

    const controller = new AbortController();

    fetch(`${API_URL}/api/crowd-reports?placeIds=${encodeURIComponent(placeIds)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load crowd summaries.");
        setCrowdSummaries(data.summaries ?? {});
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCrowdSummaries({});
        }
      });

    return () => controller.abort();
  }, [placeIds]);

  useEffect(() => {
    const handleCrowdSummaryUpdate = (event: Event) => {
      const summary = (event as CustomEvent<CrowdSummary>).detail;
      if (!summary?.placeId) return;

      setCrowdSummaries((current) => ({
        ...current,
        [summary.placeId]: summary,
      }));
    };

    window.addEventListener(crowdSummaryUpdatedEvent, handleCrowdSummaryUpdate);

    return () => window.removeEventListener(crowdSummaryUpdatedEvent, handleCrowdSummaryUpdate);
  }, []);

  const scrollId = useMemo(() => `carousel-${title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`, [title]);

  const handleScroll = (direction: "left" | "right") => {
    const el = document.getElementById(scrollId);
    if (el) {
      const scrollAmt = direction === "left" ? -400 : 400;
      el.scrollBy({ left: scrollAmt, behavior: "smooth" });
    }
  };

  if (loading) {
    return <DiscoverySectionSkeleton />;
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      className="space-y-3 py-4 md:space-y-5 md:py-8"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-black tracking-tight text-[var(--foreground)] sm:text-2xl md:text-3xl">{title}</h2>
          {description && <p className="max-w-2xl text-sm leading-5 text-[var(--muted)] md:text-base md:leading-6">{description}</p>}
        </div>
        <span className="w-fit rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)] sm:text-xs sm:tracking-[0.16em]">
          {places.length} places
        </span>
      </div>

      {places.length > 0 ? (
        carousel ? (
          <div className="relative group">
            {/* Scroll Navigation Arrows */}
            <button
              onClick={() => handleScroll("left")}
              type="button"
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 hidden group-hover:flex h-9 w-9 items-center justify-center rounded-full bg-[var(--panel-strong)] border border-[var(--border)] text-[var(--foreground)] backdrop-blur-sm shadow-xl hover:bg-[var(--panel)] transition hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="Previous spots"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Scrollable container snaps */}
            <div
              id={scrollId}
              className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-3"
            >
              {places.map((place, index) => (
                <div key={place.id} className="w-[82vw] max-w-[320px] shrink-0 snap-start sm:w-[320px]">
                  <DiscoveryCard
                    place={place}
                    index={index}
                    onClick={() => onPlaceClick?.(place)}
                    onSave={onSavePlace}
                    isSaved={savedPlaceIds?.has(place.id)}
                    crowdSummary={crowdSummaries[place.id]}
                    vibeMatch={vibeScores?.[place.id]}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => handleScroll("right")}
              type="button"
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 hidden group-hover:flex h-9 w-9 items-center justify-center rounded-full bg-[var(--panel-strong)] border border-[var(--border)] text-[var(--foreground)] backdrop-blur-sm shadow-xl hover:bg-[var(--panel)] transition hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="Next spots"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {places.map((place, index) => (
              <DiscoveryCard
                key={place.id}
                place={place}
                index={index}
                onClick={() => onPlaceClick?.(place)}
                onSave={onSavePlace}
                isSaved={savedPlaceIds?.has(place.id)}
                crowdSummary={crowdSummaries[place.id]}
                vibeMatch={vibeScores?.[place.id]}
              />
            ))}
          </motion.div>
        )
      ) : (
        <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-5 text-center sm:p-8">
          <div className="max-w-sm">
            <Search className="mx-auto mb-3 text-[var(--muted)]" size={26} />
            <p className="font-bold text-[var(--foreground)]">No matches yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Try a different filter, or jump into another city flow.</p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <Link
                href="/discover"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-black text-[var(--primary-foreground)]"
              >
                <Compass size={14} />
                Discover Spots
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs font-black text-[var(--foreground)]"
              >
                <CalendarDays size={14} />
                See Events
              </Link>
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
};
