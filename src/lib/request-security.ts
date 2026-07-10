import { NextRequest } from "next/server";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const normalizeOrigin = (value: string | null | undefined) => {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const getAllowedOrigins = (request: NextRequest) => {
  const origins = new Set<string>();

  for (const value of [
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ]) {
    const origin = normalizeOrigin(value);
    if (origin) origins.add(origin);
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add(request.nextUrl.origin);
    origins.add("http://localhost:3000");
    origins.add("http://localhost:3001");
    origins.add("http://localhost:8081");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://127.0.0.1:3001");
    origins.add("http://127.0.0.1:8081");
  }

  return origins;
};

export const verifyTrustedOrigin = (request: NextRequest) => {
  if (!unsafeMethods.has(request.method.toUpperCase())) return null;

  const allowedOrigins = getAllowedOrigins(request);
  const origin = normalizeOrigin(request.headers.get("origin"));
  if (origin) {
    return allowedOrigins.has(origin) ? null : "Request origin is not allowed.";
  }

  const referer = normalizeOrigin(request.headers.get("referer"));
  if (referer) {
    return allowedOrigins.has(referer) ? null : "Request referrer is not allowed.";
  }

  return "Request origin could not be verified.";
};

export const requireTrustedOrigin = (request: NextRequest) => {
  const error = verifyTrustedOrigin(request);
  if (!error) return null;

  return Response.json({ error }, { status: 403 });
};
