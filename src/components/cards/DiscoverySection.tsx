"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CrowdSummary, Place } from "@/types";
import { DiscoveryCard } from "./DiscoveryCard";
import { DiscoverySectionSkeleton } from "@/components/common/Skeleton";

const crowdSummaryUpdatedEvent = "town-discover:crowd-summary-updated";

interface DiscoverySectionProps {
  title: string;
  description?: string;
  places: Place[];
  loading?: boolean;
  onPlaceClick?: (place: Place) => void;
  onSavePlace?: (place: Place) => void;
  savedPlaceIds?: Set<string>;
}

export const DiscoverySection: React.FC<DiscoverySectionProps> = ({
  title,
  description,
  places,
  loading = false,
  onPlaceClick,
  onSavePlace,
  savedPlaceIds,
}) => {
  const [crowdSummaries, setCrowdSummaries] = useState<Record<string, CrowdSummary>>({});
  const placeIds = useMemo(() => places.map((place) => place.id).join(","), [places]);

  useEffect(() => {
    if (!placeIds) {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/crowd-reports?placeIds=${encodeURIComponent(placeIds)}`, {
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

  if (loading) {
    return <DiscoverySectionSkeleton />;
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      className="space-y-4 py-5 md:space-y-5 md:py-8"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-black tracking-tight text-[var(--foreground)] sm:text-2xl md:text-3xl">{title}</h2>
          {description && <p className="max-w-2xl text-sm leading-6 text-[var(--muted)] md:text-base">{description}</p>}
        </div>
        <span className="w-fit rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)] sm:text-xs sm:tracking-[0.16em]">
          {places.length} places
        </span>
      </div>

      {places.length > 0 ? (
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
            />
          ))}
        </motion.div>
      ) : (
        <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-8 text-center">
          <div>
            <Search className="mx-auto mb-3 text-[var(--muted)]" size={26} />
            <p className="font-bold text-[var(--foreground)]">No matches yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Try a different category, query, or open-now filter.</p>
          </div>
        </div>
      )}
    </motion.section>
  );
};
