"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Camera, Clock, Download, ExternalLink, MapPin, Navigation, PlayCircle, Share2, Star, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CrowdLevel, CrowdSummary, Place } from "@/types";
import { formatDistance, formatHours, formatTime, getCategoryLabel, isOpenNow } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

interface PlaceDetailModalProps {
  place: Place | null;
  onClose: () => void;
}

const crowdOptions: { level: CrowdLevel; label: string; description: string }[] = [
  { level: "low", label: "Quiet", description: "Easy entry" },
  { level: "moderate", label: "Steady", description: "Some people" },
  { level: "busy", label: "Busy", description: "Short wait likely" },
  { level: "very_crowded", label: "Packed", description: "Expect a wait" },
];

const crowdLabels: Record<CrowdLevel, string> = {
  low: "Quiet now",
  moderate: "Steady crowd",
  busy: "Busy now",
  very_crowded: "Packed now",
};

const crowdStyles: Record<CrowdLevel, string> = {
  low: "bg-emerald-300 text-slate-950",
  moderate: "bg-cyan-300 text-slate-950",
  busy: "bg-amber-300 text-slate-950",
  very_crowded: "bg-rose-500 text-white",
};

const crowdSummaryUpdatedEvent = "sheher:crowd-summary-updated";

const formatReportTime = (value: string) => {
  const reportedAt = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.round((Date.now() - reportedAt) / 60000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const getRatingSource = (place: Place) => {
  if (place.id.startsWith("osm-")) {
    return "Estimated from live OpenStreetMap listing signals";
  }

  return "From curated place data and public review counts";
};

const getStatusText = (place: Place, open: boolean) => {
  if (!place.hours) return "Hours not listed";
  return open ? `Open until ${formatTime(place.hours.close)}` : `Opens at ${formatTime(place.hours.open)}`;
};

const getCrowdDetail = (summary: CrowdSummary) => {
  const reportText = summary.reportCount === 1 ? "1 recent report" : `${summary.reportCount} recent reports`;
  return `Based on ${reportText}`;
};

export const PlaceDetailModal: React.FC<PlaceDetailModalProps> = ({ place, onClose }) => {
  const { user, setAuthRequiredMessage } = useAuth();
  const [selectedCrowdLevel, setSelectedCrowdLevel] = useState<CrowdLevel>("moderate");
  const [crowdNote, setCrowdNote] = useState("");
  const [crowdSummary, setCrowdSummary] = useState<CrowdSummary | null>(null);
  const [crowdStatus, setCrowdStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [crowdMessage, setCrowdMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    if (!place) return;

    const controller = new AbortController();

    fetch(`/api/crowd-reports?placeId=${encodeURIComponent(place.id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load crowd report.");
        setCrowdSummary(data.summary ?? null);
        if (data.summary) {
          window.dispatchEvent(new CustomEvent<CrowdSummary>(crowdSummaryUpdatedEvent, { detail: data.summary }));
        }
        if (data.summary?.crowdLevel) {
          setSelectedCrowdLevel(data.summary.crowdLevel);
        }
        setCrowdStatus("idle");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCrowdSummary(null);
        setCrowdStatus("error");
        setCrowdMessage(error instanceof Error ? error.message : "Unable to load crowd report.");
      });

    return () => controller.abort();
  }, [place]);

  if (!place) return null;

  const open = isOpenNow(place.hours);
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  const currentSummary = crowdSummary?.placeId === place.id ? crowdSummary : null;
  const hasCrowdSignal = Boolean(currentSummary?.crowdLevel && currentSummary.reportCount > 0);
  const shareText = `Check out ${place.title} in ${place.locality}, ${place.city} on Sheher. Rating ${place.rating}/5, ${formatDistance(place.distance)} away.`;

  const submitCrowdReport = async () => {
    if (!user) {
      const message = "Please log in to report live crowd updates.";
      setCrowdStatus("error");
      setCrowdMessage(message);
      setAuthRequiredMessage(message);
      window.location.href = "/profile";
      return;
    }

    setCrowdStatus("saving");
    setCrowdMessage("");

    try {
      const response = await fetch("/api/crowd-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place.id,
          crowdLevel: selectedCrowdLevel,
          note: crowdNote,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save crowd report.");
      }

      setCrowdSummary(data.summary ?? null);
      if (data.summary) {
        window.dispatchEvent(new CustomEvent<CrowdSummary>(crowdSummaryUpdatedEvent, { detail: data.summary }));
      }
      setCrowdNote("");
      setCrowdStatus("saved");
      setCrowdMessage("Thanks. Live crowd status updated.");
    } catch (error) {
      setCrowdStatus("error");
      setCrowdMessage(error instanceof Error ? error.message : "Unable to save crowd report.");
    }
  };

  const drawWrappedText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(" ");
    let line = "";
    let currentY = y;

    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;
      if (context.measureText(testLine).width > maxWidth && line) {
        context.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
        return;
      }

      line = testLine;
    });

    if (line) {
      context.fillText(line, x, currentY);
    }
  };

  const createShareCardBlob = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create share card.");

    const gradient = context.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, "#061c23");
    gradient.addColorStop(0.48, "#10151d");
    gradient.addColorStop(1, "#f6d54a");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1080, 1350);

    context.fillStyle = "rgba(255,255,255,0.08)";
    context.fillRect(72, 72, 936, 1206);

    context.fillStyle = "#5ff2df";
    context.font = "900 44px Arial";
    context.fillText("SHEHER PICK", 112, 160);

    context.fillStyle = "#ffffff";
    context.font = "900 88px Arial";
    drawWrappedText(context, place.title, 112, 310, 820, 96);

    context.fillStyle = "#cbd5e1";
    context.font = "700 42px Arial";
    context.fillText(`${place.locality}, ${place.city}`, 112, 530);

    context.fillStyle = "#ffffff";
    context.font = "900 54px Arial";
    context.fillText(`${place.rating}/5`, 112, 690);
    context.fillText(formatDistance(place.distance), 430, 690);
    context.fillText(open ? "Open now" : "Check hours", 112, 790);

    context.fillStyle = "#cbd5e1";
    context.font = "700 34px Arial";
    drawWrappedText(context, place.description, 112, 910, 820, 48);

    context.fillStyle = "#10151d";
    context.fillRect(112, 1160, 856, 76);
    context.fillStyle = "#ffffff";
    context.font = "900 34px Arial";
    context.fillText("Find it on Sheher", 152, 1210);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Unable to export share card."));
      }, "image/png");
    });
  };

  const shareVisualCard = async () => {
    setShareMessage("");

    try {
      const blob = await createShareCardBlob();
      const file = new File([blob], `${place.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-sheher-card.png`, {
        type: "image/png",
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${place.title} on Sheher`, text: shareText, files: [file] });
        setShareMessage("Share card opened.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setShareMessage("Share card downloaded.");
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : "Unable to create share card.");
    }
  };

  const shareOnWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/68 p-0 backdrop-blur-sm md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${place.title} details`}
    >
      <motion.div
        initial={{ y: 48, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 48, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-lg border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl md:max-w-2xl md:rounded-lg"
      >
        <div className="relative h-64 overflow-hidden bg-slate-900">
          <Image src={place.image} alt={`${place.title} in ${place.locality}`} fill sizes="(max-width: 768px) 100vw, 672px" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10151d] via-[#10151d]/24 to-black/20" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close place details"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
          >
            <X size={20} />
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <span className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-950">
              {getCategoryLabel(place.category)}
            </span>
            <h2 className="text-3xl font-black tracking-tight text-white">{place.title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-300">{place.locality}</p>
          </div>
        </div>

        <div className="space-y-5 p-5 md:p-6">
          <p className="text-base leading-7 text-[var(--muted-strong)]">{place.description}</p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <Star size={14} />
                Rating
              </div>
              <p className="font-black text-[var(--foreground)]">
                {place.rating} <span className="font-medium text-[var(--muted)]">({place.reviewCount})</span>
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted)]">{getRatingSource(place)}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <MapPin size={14} />
                Distance
              </div>
              <p className="font-black text-[var(--foreground)]">{formatDistance(place.distance)}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <Clock size={14} />
                Status
              </div>
              <p className={open ? "font-black text-emerald-300" : "font-black text-rose-300"}>
                {open ? "Open now" : "Closed"}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted)]">{getStatusText(place, open)}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <Users size={14} />
                Crowd
              </div>
              {hasCrowdSignal && currentSummary?.crowdLevel ? (
                <div className="space-y-1">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${crowdStyles[currentSummary.crowdLevel]}`}>
                    {crowdLabels[currentSummary.crowdLevel]}
                  </span>
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    {getCrowdDetail(currentSummary)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-black text-[var(--foreground)]">No live crowd update</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted)]">Be the first to report today.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Today</p>
              <p className="mt-1 font-semibold text-[var(--muted-strong)]">{formatHours(place.hours)}</p>
              <p className="mt-3 text-sm text-[var(--muted)]">
                {hasCrowdSignal && currentSummary?.latestReportedAt
                  ? `Live crowd status uses reports from the last 45 minutes. Last updated ${formatReportTime(currentSummary.latestReportedAt)}.`
                  : "Opening hours come from the place listing when available. Live crowd updates appear here after someone reports."}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <Users size={14} />
                Report Crowd
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {crowdOptions.map((option) => {
                  const active = selectedCrowdLevel === option.level;
                  return (
                    <button
                      key={option.level}
                      type="button"
                      onClick={() => setSelectedCrowdLevel(option.level)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        active
                          ? "border-teal-300 bg-teal-300/15"
                          : "border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel-strong)]"
                      }`}
                    >
                      <span className="block text-sm font-black text-[var(--foreground)]">{option.label}</span>
                      <span className="mt-0.5 block text-xs font-semibold text-[var(--muted)]">{option.description}</span>
                    </button>
                  );
                })}
              </div>

              <textarea
                value={crowdNote}
                onChange={(event) => setCrowdNote(event.target.value)}
                maxLength={180}
                placeholder="Optional note, like queue at entry"
                className="mt-3 min-h-20 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-teal-300"
              />

              <button
                type="button"
                onClick={submitCrowdReport}
                disabled={crowdStatus === "saving"}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-black text-[var(--primary-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Users size={18} />
                {crowdStatus === "saving" ? "Sharing..." : user ? "Submit Report" : "Log In To Report"}
              </button>

              {crowdMessage && (
                <p className={`mt-2 text-sm font-semibold ${crowdStatus === "error" ? "text-rose-400" : "text-emerald-400"}`}>
                  {crowdMessage}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                  <Camera size={14} />
                  Creator features
                </p>
                <h3 className="mt-1 font-black text-[var(--foreground)]">Featured by local creators</h3>
              </div>
              <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-bold text-[var(--muted)]">
                {place.influencerFeatures?.length ?? 0} saved
              </span>
            </div>

            {place.influencerFeatures?.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {place.influencerFeatures.map((feature) => (
                  <a
                    key={`${feature.handle}-${feature.videoUrl}`}
                    href={feature.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 transition hover:bg-[var(--panel-strong)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-[var(--foreground)]">{feature.creatorName}</p>
                        <p className="text-sm font-semibold text-[var(--muted)]">{feature.handle}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)] px-2.5 py-1 text-xs font-black text-[var(--primary-foreground)]">
                        <Star size={12} />
                        {feature.rating}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">{feature.quote}</p>
                    <span className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[var(--fresh)]">
                      <PlayCircle size={16} />
                      Open video search
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] p-4 text-sm font-semibold text-[var(--muted)]">
                No verified creator videos saved yet. Use Search Web below to find fresh reels for this listing.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              <Share2 size={14} />
              Share this place
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={shareVisualCard}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-black text-[var(--primary-foreground)] transition hover:opacity-90"
              >
                <Download size={18} />
                Share Visual Card
              </button>
              <button
                type="button"
                onClick={shareOnWhatsApp}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 font-black text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
              >
                <Share2 size={18} />
                WhatsApp
              </button>
            </div>
            {shareMessage && <p className="mt-2 text-sm font-semibold text-emerald-300">{shareMessage}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {place.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-sm font-semibold text-[var(--muted-strong)]"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-black text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              <Navigation size={18} />
              Directions
            </a>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${place.title} ${place.city}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 font-black text-[var(--foreground)] transition hover:bg-[var(--panel)]"
            >
              <ExternalLink size={18} />
              Search Web
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
