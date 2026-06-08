export default function Loading() {
  return (
    <div className="w-full max-w-screen-xl mx-auto px-3 py-4 sm:px-4 md:px-6 md:py-10 animate-pulse">
      {/* Hero skeleton */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5 pt-3 md:pt-0">
          {/* Badge skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-44 rounded-full bg-[var(--panel-soft)]" />
            <div className="h-7 w-32 rounded-full bg-[var(--panel-soft)]" />
          </div>

          {/* Heading skeleton */}
          <div className="space-y-3">
            <div className="h-10 w-3/4 rounded-lg bg-[var(--panel-soft)] md:h-14" />
            <div className="h-5 w-2/3 rounded bg-[var(--panel-soft)]" />
          </div>

          {/* Search panel skeleton */}
          <div className="rounded-lg bg-[var(--panel-soft)] p-3 md:p-4 space-y-3">
            {/* City switcher */}
            <div className="h-10 w-full rounded-lg bg-[var(--panel)]" />
            {/* Search bar */}
            <div className="h-12 w-full rounded-lg bg-[var(--panel)] sm:h-14" />
            {/* Filter chips */}
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 w-20 shrink-0 rounded-full bg-[var(--panel)]" />
              ))}
            </div>
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-2 sm:p-4">
                <div className="h-7 w-12 rounded bg-[var(--panel)] mb-2" />
                <div className="h-3 w-16 rounded bg-[var(--panel)]" />
              </div>
            ))}
          </div>

          {/* CTA buttons skeleton */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="h-12 w-full rounded-lg bg-[var(--primary)]/20 sm:w-40" />
            <div className="h-12 w-full rounded-lg bg-[var(--panel-soft)] sm:w-32" />
            <div className="h-12 w-full rounded-lg bg-[var(--panel-soft)] sm:w-36" />
          </div>
        </div>

        {/* Featured card skeleton */}
        <div className="flex flex-col gap-5">
          <div className="min-h-[250px] w-full rounded-lg bg-[var(--panel-soft)] sm:min-h-[360px] md:min-h-[380px]" />
          <div className="rounded-lg bg-[var(--panel-soft)] p-5 h-64" />
        </div>
      </div>

      {/* Discovery sections skeleton */}
      <div className="mt-8 space-y-8">
        {Array.from({ length: 2 }).map((_, sectionIdx) => (
          <div key={sectionIdx} className="space-y-4">
            <div className="h-7 w-48 rounded bg-[var(--panel-soft)]" />
            <div className="h-4 w-72 rounded bg-[var(--panel-soft)]" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-72 rounded-xl bg-[var(--panel-soft)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
