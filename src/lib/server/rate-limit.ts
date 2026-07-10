/**
 * Sliding-window rate limiter for Next.js API routes.
 *
 * Stores counts in Redis if process.env.REDIS_URL is configured and connected.
 * Falls back to an in-memory sliding-window Map rate limiter for local development
 * or standalone single-node deployments.
 */

import { RateLimitError } from "./api-errors";
import { initRedis } from "../redis";

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

// ─── Local In-Memory Fallback Storage ─────────────────────────────────────────

const store = new Map<string, RateLimitEntry>();
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

  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

function checkInMemoryRateLimit(
  ip: string,
  routeKey: string,
  config: RateLimitConfig
): Record<string, string> {
  ensureCleanupTimer();

  const storeKey = `${routeKey}::${ip}`;
  const now = Date.now();
  let entry = store.get(storeKey);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    store.set(storeKey, entry);
  }

  entry.count += 1;

  const remaining = Math.max(0, config.max - entry.count);
  const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);

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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks the rate limit for a given IP and route key.
 * Uses Redis if available, otherwise falls back to the in-memory Map store.
 * Throws `RateLimitError` if the limit is exceeded.
 *
 * Returns headers that should be added to the response.
 */
export async function checkRateLimit(
  ip: string,
  routeKey: string,
  config: RateLimitConfig
): Promise<Record<string, string>> {
  if (process.env.REDIS_URL) {
    try {
      const client = await initRedis();
      if (client && client.isOpen) {
        const redisKey = `ratelimit:${routeKey}:${ip}`;
        
        // Atomically increment request count
        const current = await client.incr(redisKey);
        if (current === 1) {
          // Set TTL on the key if it was just created
          await client.expire(redisKey, Math.ceil(config.windowMs / 1000));
        }

        const ttl = await client.ttl(redisKey);
        const retryAfterSeconds = ttl > 0 ? ttl : Math.ceil(config.windowMs / 1000);
        const remaining = Math.max(0, config.max - current);

        const headers: Record<string, string> = {
          "X-RateLimit-Limit": String(config.max),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(Math.ceil((Date.now() + (ttl > 0 ? ttl * 1000 : config.windowMs)) / 1000)),
        };

        if (current > config.max) {
          headers["Retry-After"] = String(retryAfterSeconds);
          throw new RateLimitError(retryAfterSeconds);
        }

        return headers;
      }
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      console.warn("[rate-limit] Redis rate limiting failed, falling back to memory:", err);
    }
  }

  return checkInMemoryRateLimit(ip, routeKey, config);
}

