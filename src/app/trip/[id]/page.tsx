"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  Navigation,
  Route,
  Share2,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Place } from "@/types";
import { cn, formatPlaceArea, getCategoryLabel } from "@/lib/utils";
import { MapSkeleton } from "@/components/common/Skeleton";
import { BrandMark } from "@/components/common/BrandMark";

const MapView = dynamic(
  () => import("@/components/map/MapView").then((mod) => mod.MapView),
  { ssr: false, loading: () => <MapSkeleton /> }
);

interface TripPlan {
  id: string;
  name: string;
  source: string;
  destination: string;
  distanceKm: number | null;
  durationMinutes: number | null;
  routePath: { latitude: number; longitude: number }[];
  stops: Place[];
  createdAt: string;
  creatorName?: string;
}

const SATELLITE_CENTERS: Record<string, { primary: { lat: number; lng: number }; satellite: { lat: number; lng: number } }> = {
  HubliDharwad: {
    primary: { lat: 15.3647, lng: 75.1240 },
    satellite: { lat: 15.4589, lng: 75.0078 }
  },
  PunePCMC: {
    primary: { lat: 18.5204, lng: 73.8567 },
    satellite: { lat: 18.6298, lng: 73.7997 }
  },
  BangaloreMysore: {
    primary: { lat: 12.9716, lng: 77.5946 },
    satellite: { lat: 12.2958, lng: 76.6394 }
  },
  IndoreUjjain: {
    primary: { lat: 22.7196, lng: 75.8577 },
    satellite: { lat: 23.1760, lng: 75.7885 }
  },
  HyderabadSecunderabad: {
    primary: { lat: 17.3850, lng: 78.4867 },
    satellite: { lat: 17.4399, lng: 78.4983 }
  }
};

const TRANSIT_GUIDES: Record<string, { distance: string; duration: string; highwayName: string; modes: { icon: string; name: string }[] }> = {
  HubliDharwad: {
    distance: "20 km",
    duration: "30-40 mins",
    highwayName: "AH47 Highway",
    modes: [{ icon: "🚌", name: "BRTS Corridor" }]
  },
  PunePCMC: {
    distance: "15 km",
    duration: "25-35 mins",
    highwayName: "Old Mumbai Highway",
    modes: [{ icon: "🚇", name: "Metro Line 1" }]
  },
  BangaloreMysore: {
    distance: "140 km",
    duration: "2 - 2.5 hours",
    highwayName: "NH 275 Expressway",
    modes: [{ icon: "🚂", name: "Vande Bharat" }]
  },
  IndoreUjjain: {
    distance: "55 km",
    duration: "1 - 1.2 hours",
    highwayName: "SH 27 Highway",
    modes: [{ icon: "🚌", name: "Chartered Bus" }]
  },
  HyderabadSecunderabad: {
    distance: "10 km",
    duration: "20-30 mins",
    highwayName: "Tank Bund Rd",
    modes: [{ icon: "🚇", name: "Green Line" }]
  }
};

const getStopSubCity = (stop: Place): string => {
  const city = stop.city;
  const twins = SATELLITE_CENTERS[city];
  if (!twins) return city;

  const distToPrimary = Math.hypot(stop.latitude - twins.primary.lat, stop.longitude - twins.primary.lng);
  const distToSatellite = Math.hypot(stop.latitude - twins.satellite.lat, stop.longitude - twins.satellite.lng);
  
  if (distToPrimary <= distToSatellite) {
    if (city === "HubliDharwad") return "Hubli";
    if (city === "PunePCMC") return "Pune";
    if (city === "BangaloreMysore") return "Bangalore";
    if (city === "IndoreUjjain") return "Indore";
    if (city === "HyderabadSecunderabad") return "Hyderabad";
  } else {
    if (city === "HubliDharwad") return "Dharwad";
    if (city === "PunePCMC") return "PCMC";
    if (city === "BangaloreMysore") return "Mysore";
    if (city === "IndoreUjjain") return "Ujjain";
    if (city === "HyderabadSecunderabad") return "Secunderabad";
  }
  
  return city;
};

export default function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlan = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/trip-plans?id=${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok || !data.plan) {
          setError(data.error ?? "Trip not found.");
          return;
        }

        setPlan(data.plan);
      } catch {
        if (!cancelled) setError("Failed to load trip. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPlan();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const shareUrl = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/trip/${id}`
        : "",
    [id]
  );

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!plan) return;
    try {
      await navigator.share({
        title: plan.name,
        text: `Check out this trip: ${plan.source} to ${plan.destination}`,
        url: shareUrl,
      });
    } catch {
      // share cancelled
    }
  }, [plan, shareUrl]);

  const handleShareWhatsApp = useCallback(() => {
    if (!plan) return;
    const text = encodeURIComponent(
      `Hey, I'm doing this trip. Come along!\n\n${plan.name}\n${plan.source} to ${plan.destination}\n${plan.distanceKm ?? "-"} km - ${plan.stops.length} stops\n\n${shareUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }, [plan, shareUrl]);

  const routeCenter = useMemo(() => {
    if (!plan?.routePath?.length) return null;
    const mid = plan.routePath[Math.floor(plan.routePath.length / 2)];
    return mid;
  }, [plan]);

  const formattedDate = useMemo(() => {
    if (!plan) return "";
    return new Date(plan.createdAt).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [plan]);

  const durationLabel = useMemo(() => {
    if (!plan?.durationMinutes) return null;
    const h = Math.floor(plan.durationMinutes / 60);
    const m = plan.durationMinutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }, [plan]);

  // Loading / Error states

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-400/30 border-t-teal-400" />
          <p className="text-sm font-bold text-[var(--muted)]">
            Loading trip itinerary...
          </p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-500/10 text-rose-400">
            <Route size={32} />
          </div>
          <h2 className="text-xl font-black text-[var(--foreground)]">
            Trip not found
          </h2>
          <p className="text-sm font-semibold text-[var(--muted)]">
            {error ??
              "This trip link may have expired or been removed."}
          </p>
          <Link
            href="/map"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-black text-[var(--primary-foreground)] transition hover:opacity-90"
          >
            <MapPin size={16} />
            Go to Map
          </Link>
        </div>
      </div>
    );
  }

  // Main Trip Page

  return (
    <div className="w-full max-w-full min-h-screen overflow-x-hidden pb-28">
      {/* Hero Header */}
      <header
        className="relative z-40 border-b border-[var(--border)] bg-[var(--nav)] md:sticky md:top-16 md:backdrop-blur-xl"
      >
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
          className="mx-auto flex max-w-screen-xl flex-col gap-3 px-3 py-3 sm:px-4 md:flex-row md:items-end md:justify-between md:px-6 md:py-5"
        >
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fresh)]">
              <Route size={13} />
              Shared Trip
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark size="lg" showWordmark={false} />
              <h1 className="truncate text-xl font-black tracking-tight text-[var(--foreground)] sm:text-2xl md:text-3xl">
                {plan.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-black text-[var(--muted-strong)] transition hover:bg-[var(--panel)] hover:text-[var(--foreground)]"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-black text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              <Share2 size={14} />
              Share
            </button>
          </div>
        </motion.div>
      </header>

      <div className="mx-auto max-w-screen-xl px-3 py-5 sm:px-4 md:px-6 md:py-8">
        {/* Trip stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.06 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4"
        >
          {/* Source to Destination */}
          <div className="col-span-2 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 sm:col-span-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-400/10 text-teal-400">
              <Navigation size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                Route
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 font-black text-[var(--foreground)] sm:text-lg">
                <span className="truncate">{plan.source}</span>
                <ArrowRight size={15} className="shrink-0 text-teal-400" />
                <span className="truncate">{plan.destination}</span>
              </p>
            </div>
          </div>

          {/* Distance */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
              Distance
            </p>
            <p className="mt-1 text-2xl font-black text-[var(--foreground)]">
              {plan.distanceKm ?? "-"}
              <span className="ml-1 text-sm font-bold text-[var(--muted)]">
                km
              </span>
            </p>
          </div>

          {/* Duration */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
              Est. Time
            </p>
            <p className="mt-1 text-2xl font-black text-[var(--foreground)]">
              {durationLabel ?? "-"}
            </p>
          </div>
        </motion.div>

        {/* Creator + Date info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-[var(--muted)]"
        >
          {plan.creatorName && (
            <span className="inline-flex items-center gap-1.5">
              <Users size={13} className="text-teal-400" />
              Created by{" "}
              <strong className="text-[var(--foreground)]">
                {plan.creatorName}
              </strong>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={13} className="text-[var(--muted)]" />
            {formattedDate}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={13} className="text-cyan-400" />
            {plan.stops.length} stops along the route
          </span>
        </motion.div>

        {/* Come With Me social share card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
          className="mt-6 overflow-hidden rounded-xl border border-emerald-400/20 bg-gradient-to-r from-emerald-500/[0.06] via-teal-500/[0.04] to-transparent p-4 shadow-lg backdrop-blur-md sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-[var(--foreground)] sm:text-base">
                I&apos;m doing this trip. Come along for timepass!
              </h3>
              <p className="text-xs font-semibold text-[var(--muted-strong)]">
                Share this trip with friends nearby and explore together.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-500/15 transition hover:bg-emerald-400 active:scale-[0.97]"
              >
                Share on WhatsApp
              </button>
              <button
                type="button"
                onClick={handleNativeShare}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 text-xs font-black text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
              >
                <Share2 size={14} />
                More
              </button>
            </div>
          </div>
        </motion.div>

        {/* Route Map */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.42 }}
          className="mt-6 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] shadow-2xl"
        >
          <div className="relative h-[40vh] min-h-[300px] sm:h-[50vh] md:h-[56vh]">
            <MapView
              places={plan.stops}
              userLocation={
                routeCenter
                  ? {
                      latitude: routeCenter.latitude,
                      longitude: routeCenter.longitude,
                      accuracy: 0,
                    }
                  : null
              }
              tripMode
              tripRoutePath={plan.routePath}
              className="h-full min-h-full rounded-none border-0"
            />
          </div>
        </motion.div>

        {/* Open in Map CTA */}
        <div className="mt-4 flex justify-center">
          <Link
            href={`/map?tripPlan=${id}`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-5 py-2.5 text-xs font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--panel-strong)] hover:shadow-md"
          >
            <ExternalLink size={14} className="text-cyan-400" />
            Open in full Map view
          </Link>
        </div>

        {/* Stops Timeline */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.42 }}
          className="mt-8"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[var(--foreground)] sm:text-xl">
                Route Stops
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">
                {plan.stops.length} pitstops discovered along this route
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-400 border border-cyan-400/20">
              {plan.stops.length} stops
            </span>
          </div>

          <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-5 top-4 bottom-4 w-px bg-gradient-to-b from-teal-400/40 via-cyan-400/20 to-transparent sm:left-6" />

            {plan.stops.map((stop, index) => {
              const isExpanded = selectedStop === stop.id;
              const currentSubCity = getStopSubCity(stop);
              const prevStop = index > 0 ? plan.stops[index - 1] : null;
              const prevSubCity = prevStop ? getStopSubCity(prevStop) : null;
              const showCrossing = prevSubCity && currentSubCity !== prevSubCity;
              const transitDetails = showCrossing ? TRANSIT_GUIDES[stop.city] : null;

              return (
                <div key={stop.id}>
                  {showCrossing && transitDetails && (
                    <div className="relative pl-12 sm:pl-14 my-4 flex gap-3 group">
                      <div className="absolute left-5 top-0 bottom-0 w-px border-l-2 border-dashed border-teal-400/40 sm:left-6" />
                      <div className="absolute left-2.5 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border border-teal-500/30 text-teal-400 sm:left-3.5 shadow-md">
                        🌉
                      </div>
                      <div className="flex-1 rounded-xl border border-teal-500/20 bg-gradient-to-r from-teal-500/5 via-cyan-500/5 to-transparent p-3 text-left">
                        <div className="flex justify-between items-center gap-2">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-400">Transit Corridor crossing</p>
                            <p className="text-xs font-black text-[var(--foreground)] mt-0.5">
                              Crossing over from {prevSubCity} to {currentSubCity}
                            </p>
                            <p className="text-[10px] text-[var(--muted)] mt-0.5">
                              Approx. {transitDetails.distance} travel via {transitDetails.highwayName} ({transitDetails.duration})
                            </p>
                          </div>
                          <div className="flex gap-1 text-xs text-teal-400/80 font-bold shrink-0 bg-teal-500/10 px-1.5 py-0.5 rounded">
                            <span>{transitDetails.modes[0]?.icon}</span>
                            <span>{transitDetails.modes[0]?.name}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * Math.min(index, 20), duration: 0.32 }}
                    className="relative pl-12 sm:pl-14 animate-fade-in"
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-3.5 top-5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[var(--background)] bg-teal-400 shadow-sm shadow-teal-400/30 sm:left-4.5 sm:h-4 sm:w-4">
                      {index === 0 && (
                        <span className="absolute h-full w-full animate-ping rounded-full bg-teal-400/50" />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedStop(isExpanded ? null : stop.id)
                      }
                      className={cn(
                        "w-full rounded-xl border p-4 text-left transition-all mb-3",
                        isExpanded
                          ? "border-cyan-400/40 bg-cyan-400/[0.06] shadow-lg"
                          : "border-[var(--border)] bg-[var(--panel-soft)] hover:bg-[var(--panel)] hover:border-[var(--border)]"
                      )}
                    >
                      {/* Stop number badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--panel)] text-[9px] font-black text-[var(--muted-strong)] border border-[var(--border)]">
                              {index + 1}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                              {getCategoryLabel(stop.category, stop.tags)}
                            </span>
                          </div>
                          <h3 className="mt-1.5 line-clamp-1 text-sm font-black text-[var(--foreground)] sm:text-base">
                            {stop.title}
                          </h3>
                          <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-[var(--muted-strong)]">
                            {formatPlaceArea(stop)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-400 border border-amber-400/20">
                            <Star
                              size={10}
                              className="fill-amber-400 text-amber-400"
                            />
                            {stop.rating}
                          </span>
                          {stop.priceRange && (
                            <span className="text-[10px] font-bold text-[var(--muted)]">
                              {stop.priceRange}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 space-y-2.5 border-t border-[var(--border)] pt-3">
                              <p className="text-xs leading-5 text-[var(--muted-strong)]">
                                {stop.description}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {stop.tags.slice(0, 6).map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[9px] font-bold text-[var(--muted)] border border-[var(--border)]"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  </motion.div>
                </div>
              );
            })}

            {/* End marker */}
            <div className="relative pl-12 sm:pl-14">
              <div className="absolute left-3.5 top-2 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[var(--background)] bg-rose-400 shadow-sm sm:left-4.5 sm:h-4 sm:w-4" />
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-400">
                  Destination
                </p>
                <p className="mt-1 text-sm font-black text-[var(--foreground)]">
                  {plan.destination}
                </p>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Floating Bottom Share Bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--nav)] backdrop-blur-xl md:hidden">
        <div
          className="mx-auto flex max-w-screen-xl items-center justify-between gap-3 px-4 py-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[var(--foreground)]">
              {plan.name}
            </p>
            <p className="text-[10px] font-semibold text-[var(--muted)]">
              {plan.distanceKm ?? "-"} km - {plan.stops.length} stops
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
            >
              {copied ? (
                <Check size={16} className="text-emerald-400" />
              ) : (
                <Copy size={16} />
              )}
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-400"
            >
              WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
