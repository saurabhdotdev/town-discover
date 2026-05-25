"use client";

type LocationSource = "browser" | "fallback";

interface LocationPermissionCardProps {
  source: LocationSource;
  loading: boolean;
  error: string | null;
  onRequest: () => void;
}

export const LocationPermissionCard: React.FC<LocationPermissionCardProps> = ({
  source,
  loading,
  error,
  onRequest,
}) => {
  if (source === "browser") return null;

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="font-semibold leading-6 text-[var(--muted-strong)]">
        {error ?? "Share your location to sort places near you instead of the selected city center."}
      </p>
      <button
        type="button"
        onClick={onRequest}
        disabled={loading}
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-black text-[var(--primary-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Checking..." : "Use my location"}
      </button>
    </div>
  );
};
