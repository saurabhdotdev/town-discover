"use client";

import { useCallback, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, X } from "lucide-react";

type LocationSource = "browser" | "fallback";

interface LocationPermissionCardProps {
  source: LocationSource;
  loading: boolean;
  error: string | null;
  onRequest: () => void;
}

const DISMISS_KEY = "sheher-location-prompt-dismissed";
const DISMISS_EVENT = "sheher-location-prompt-dismissed-change";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function saveDismiss(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Storage quota or privacy mode; silently ignore.
  }
}

function subscribeDismiss(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(DISMISS_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(DISMISS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export const LocationPermissionCard: React.FC<LocationPermissionCardProps> = ({
  source,
  loading,
  error,
  onRequest,
}) => {
  const dismissed = useSyncExternalStore(
    subscribeDismiss,
    isDismissed,
    () => true
  );

  const handleDismiss = useCallback(() => {
    saveDismiss();
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }, []);

  if (source === "browser" || dismissed) return null;

  const isPermissionDenied =
    error?.toLowerCase().includes("blocked") ||
    error?.toLowerCase().includes("denied");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.38, ease: "easeOut" }}
        className="relative mt-3 overflow-hidden rounded-xl border border-teal-400/20 bg-gradient-to-br from-teal-500/[0.06] via-cyan-500/[0.04] to-transparent p-4 shadow-lg backdrop-blur-md sm:p-5"
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-cyan-400/8 blur-2xl" />

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
          aria-label="Dismiss location prompt"
        >
          <X size={15} />
        </button>

        <div className="flex items-start gap-3.5 sm:gap-4">
          <div className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-400/15 text-teal-400 shadow-inner sm:h-12 sm:w-12">
            <MapPin size={22} className="relative z-10" />
            <span
              className="absolute inset-0 animate-ping rounded-xl bg-teal-400/20"
              style={{ animationDuration: "2.5s" }}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-2.5">
            {isPermissionDenied ? (
              <>
                <div>
                  <h3 className="text-sm font-black text-[var(--foreground)] sm:text-base">
                    Location is blocked
                  </h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted-strong)] sm:text-sm sm:leading-6">
                    Tap the{" "}
                    <span className="inline-flex items-center gap-1 rounded bg-[var(--panel-soft)] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--foreground)]">
                      lock icon
                    </span>{" "}
                    in your browser&apos;s address bar, choose{" "}
                    <strong>Allow location</strong>, then tap below to try
                    again.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRequest}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 text-xs font-black text-white shadow-lg shadow-teal-500/20 transition hover:bg-teal-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                >
                  <MapPin size={15} />
                  {loading ? "Checking..." : "Try again"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-black text-[var(--foreground)] sm:text-base">
                    Let Sheher find spots near you
                  </h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted-strong)] sm:text-sm sm:leading-6">
                    Share your location and we&apos;ll sort the best cafes,
                    food stalls, and hangouts closest to you, with less
                    scrolling and more exploring.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onRequest}
                    disabled={loading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 text-xs font-black text-white shadow-lg shadow-teal-500/20 transition hover:bg-teal-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                  >
                    <MapPin size={15} />
                    {loading ? "Checking..." : "Share my location"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-xs font-bold text-[var(--muted)] transition hover:text-[var(--muted-strong)]"
                  >
                    Not now
                  </button>
                </div>
              </>
            )}

            {error && !isPermissionDenied && (
              <p className="text-[11px] font-semibold leading-4 text-amber-400/90">
                {error}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
