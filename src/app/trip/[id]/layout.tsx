import type { Metadata } from "next";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://sheher-city.vercel.app";

async function fetchTripPlan(id: string) {
  try {
    const res = await fetch(
      `${API_BASE}/api/trip-plans?id=${encodeURIComponent(id)}`,
      { next: { revalidate: 300 } } // 5-minute cache
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.plan ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const plan = await fetchTripPlan(id);

  if (!plan) {
    return {
      title: "Shared Trip | Sheher",
      description: "View this shared trip on Sheher.",
    };
  }

  const stopsLabel = `${plan.stops?.length ?? 0} stops`;
  const distLabel = plan.distanceKm ? `${plan.distanceKm} km` : null;
  const routeLabel = `${plan.source} → ${plan.destination}`;
  const description = [
    `Trip: ${routeLabel}`,
    distLabel,
    stopsLabel,
    plan.creatorName ? `by ${plan.creatorName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: `${plan.name} | Sheher Trip`,
    description,
    openGraph: {
      title: `${plan.name} — Sheher Trip`,
      description,
      url: `https://sheher-city.vercel.app/trip/${id}`,
      siteName: "Sheher",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: `${plan.name} — trip from ${plan.source} to ${plan.destination}`,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${plan.name} | Sheher Trip`,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default function TripLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
