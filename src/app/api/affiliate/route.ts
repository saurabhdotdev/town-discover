import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { AffiliateSource, withSheherTrackingParams } from "@/lib/monetization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TARGET_HOSTS = new Set([
  "in.bookmyshow.com",
  "www.townscript.com",
  "insider.in",
  "paytm.com",
  "www.makemytrip.com",
  "www.goibibo.com",
  "www.booking.com",
  "www.agoda.com",
  "www.zomato.com",
  "www.google.com",
]);

const SOURCE_FALLBACK: AffiliateSource = "events";

const parseSource = (value: string | null): AffiliateSource => {
  if (
    value === "events" ||
    value === "airport-lounge" ||
    value === "airport-offer" ||
    value === "place-detail" ||
    value === "trip"
  ) {
    return value;
  }

  return SOURCE_FALLBACK;
};

const parseTargetUrl = (value: string | null): URL | null => {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!ALLOWED_TARGET_HOSTS.has(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
};

export const GET = createApiHandler(
  { auth: "optional", rateLimitKey: "GET:/api/affiliate" },
  async (request: NextRequest, { pool, user }) => {
    const target = parseTargetUrl(request.nextUrl.searchParams.get("target"));
    if (!target) {
      return Response.json({ error: "Unsupported affiliate destination." }, { status: 400 });
    }

    const source = parseSource(request.nextUrl.searchParams.get("source"));
    const campaign = request.nextUrl.searchParams.get("campaign")?.slice(0, 80) || "city-discovery";
    const trackedTarget = withSheherTrackingParams(target.toString(), source, campaign);

    await pool.query(
      `
      INSERT INTO affiliate_clicks (user_id, source, campaign, target_host, target_url, is_premium_user, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        user?.id ?? null,
        source,
        campaign,
        target.hostname,
        target.toString(),
        Boolean(user?.isPremiumPass),
        request.headers.get("user-agent"),
      ]
    );

    return NextResponse.redirect(trackedTarget, 302);
  }
);

