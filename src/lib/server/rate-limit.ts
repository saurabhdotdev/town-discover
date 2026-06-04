/**
 * In-memory sliding-window rate limiter for Next.js API routes.
 *
 * Tracks request counts per IP using a Map with automatic cleanup.
 * Designed for single-instance deployments (Vercel, single-node).
 *
 * For multi-instance consistency, this could be swapped to use Redis
 * via the existing `src/lib/redis.ts` module.
 */

import { RateLimitError } from "./api-errors";

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window. */
  max: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ─── Default Presets ──────────────────────────────────────────────────────────

/** Default limit for read endpoints (GET). */
export const RATE_LIMIT_READ: RateLimitConfig = { max: 100, windowMs: 60_000 };

/** Default limit for write endpoints (POST/PUT/PATCH/DELETE). */
export const RATE_LIMIT_WRITE: RateLimitConfig = { max: 30, windowMs: 60_000 };

/** Strict limit for auth endpoints (login, signup). */
export const RATE_LIMIT_AUTH: RateLimitConfig = { max: 5, windowMs: 10 * 60_000 };

/** Very strict limit for admin actions. */
export const RATE_LIMIT_ADMIN: RateLimitConfig = { max: 20, windowMs: 60_000 };

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Each unique combination of (route, ip) gets its own entry.
 * Key format: `${routeKey}::${ip}`
 */
const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent unbounded memory growth.
// Runs every 5 minutes and removes all expired entries.
const CLEANUP_INTERVAL_MS = 5 * 60_000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow the process to exit cleanly even if the timer is still active
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks the rate limit for a given IP and route key.
 * Throws `RateLimitError` if the limit is exceeded.
 *
 * Returns headers that should be added to the response.
 */
export function checkRateLimit(
  ip: string,
  routeKey: string,
  config: RateLimitConfig
): Record<string, string> {
  ensureCleanupTimer();

  const storeKey = `${routeKey}::${ip}`;
  const now = Date.now();
  let entry = store.get(storeKey);

  // If entry has expired, reset it
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    store.set(storeKey, entry);
  }

  entry.count += 1;

  const remaining = Math.max(0, config.max - entry.count);
  const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);

  // Rate limit headers (RFC 6585 / draft-ietf-httpapi-ratelimit-headers)
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(config.max),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
  };

  if (entry.count > config.max) {
    headers["Retry-After"] = String(retryAfterSeconds);
    throw new RateLimitError(retryAfterSeconds);
  }

  return headers;
}
