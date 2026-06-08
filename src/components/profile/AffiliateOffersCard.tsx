"use client";

import { ExternalLink, Hotel, Ticket, Utensils } from "lucide-react";
import { buildAffiliateRedirectUrl } from "@/lib/monetization";

const AFFILIATE_OFFERS = [
  {
    title: "Book weekend events",
    description: "Tickets, comedy nights, concerts, and workshops.",
    href: "https://in.bookmyshow.com/explore/events",
    source: "events" as const,
    campaign: "profile-events",
    icon: Ticket,
  },
  {
    title: "Plan a staycation",
    description: "Hotel stays for city breaks and nearby escapes.",
    href: "https://www.booking.com/",
    source: "trip" as const,
    campaign: "profile-stays",
    icon: Hotel,
  },
  {
    title: "Find dining deals",
    description: "Restaurants, cafes, and food discovery nearby.",
    href: "https://www.zomato.com/search",
    source: "place-detail" as const,
    campaign: "profile-dining",
    icon: Utensils,
  },
];

export const AffiliateOffersCard = () => {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-lg">
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-300">Partner perks</p>
        <h3 className="mt-1 text-base font-black text-[var(--foreground)]">Earnable booking links</h3>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-[var(--muted)]">
          These links are ready for affiliate tracking and partner payouts.
        </p>
      </div>

      <div className="space-y-2">
        {AFFILIATE_OFFERS.map((offer) => {
          const Icon = offer.icon;
          const href = buildAffiliateRedirectUrl(offer.href, offer.source, offer.campaign);

          return (
            <a
              key={offer.title}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3 transition hover:border-teal-400/40 hover:bg-[var(--panel-strong)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-400/10 text-teal-300">
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black text-[var(--foreground)]">{offer.title}</span>
                <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-[var(--muted)]">{offer.description}</span>
              </span>
              <ExternalLink size={14} className="shrink-0 text-[var(--muted)]" />
            </a>
          );
        })}
      </div>
    </div>
  );
};

