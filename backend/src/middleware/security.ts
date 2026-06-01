import { Request, Response, NextFunction } from "express";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const normalizeOrigin = (value: string | undefined) => {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const getAllowedOrigins = () => {
  const origins = new Set<string>();

  for (const value of [
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_APP_URL,
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
