import { Request, Response, NextFunction } from "express";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const jsonContentTypes = new Set([
  "application/json",
  "application/x-www-form-urlencoded",
]);
const allowedRequestIdPattern = /^[a-zA-Z0-9._:-]{1,80}$/;

const normalizeOrigin = (value: string | undefined) => {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const collectOrigins = (value: string | undefined) => {
  if (!value) return [];
  return value
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin));
};

export const getAllowedOrigins = () => {
  const origins = new Set<string>();

  for (const value of [
    ...collectOrigins(process.env.CORS_ORIGINS),
    ...collectOrigins(process.env.ALLOWED_ORIGINS),
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
    origins.add("http://localhost:3000");
    origins.add("http://localhost:3001");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://127.0.0.1:3001");
  }

  return origins;
};

export const sanitizeRequestId = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return allowedRequestIdPattern.test(trimmed) ? trimmed : null;
};

export const isAllowedOrigin = (
  value: string | undefined,
  allowedOrigins = getAllowedOrigins()
) => {
  const origin = normalizeOrigin(value);
  return Boolean(origin && allowedOrigins.has(origin));
};

export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");

  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
};

export const requireSupportedContentType = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!unsafeMethods.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const contentLength = Number(req.get("content-length") ?? 0);
  if (contentLength <= 0) {
    next();
    return;
  }

  const contentType = req.is([...jsonContentTypes]);
  if (contentType) {
    next();
    return;
  }

  res.status(415).json({ error: "Unsupported content type." });
};

export const requireTrustedOrigin = (req: Request, res: Response, next: NextFunction) => {
  if (!unsafeMethods.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const allowedOrigins = getAllowedOrigins();
  const origin = normalizeOrigin(req.get("origin"));
  if (origin) {
    if (allowedOrigins.has(origin)) {
      next();
      return;
    }

    res.status(403).json({ error: "Request origin is not allowed." });
    return;
  }

  const referer = normalizeOrigin(req.get("referer"));
  if (referer) {
    if (allowedOrigins.has(referer)) {
      next();
      return;
    }

    res.status(403).json({ error: "Request referrer is not allowed." });
    return;
  }

  res.status(403).json({ error: "Request origin could not be verified." });
};
