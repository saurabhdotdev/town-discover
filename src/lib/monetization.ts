export type AffiliateSource =
  | "events"
  | "airport-lounge"
  | "airport-offer"
  | "place-detail"
  | "trip";

const SHEHER_UTM_SOURCE = "sheher";

export const withSheherTrackingParams = (targetUrl: string, source: AffiliateSource, campaign = "city-discovery") => {
  const url = new URL(targetUrl);
  url.searchParams.set("utm_source", SHEHER_UTM_SOURCE);
  url.searchParams.set("utm_medium", "affiliate");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("utm_content", source);

  return url.toString();
};

export const buildAffiliateRedirectUrl = (targetUrl: string, source: AffiliateSource, campaign = "city-discovery") => {
  const params = new URLSearchParams({
    target: targetUrl,
    source,
    campaign,
  });

  return `/api/affiliate?${params.toString()}`;
};

