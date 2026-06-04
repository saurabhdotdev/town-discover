/**
 * Centralized API handler wrapper for Next.js route handlers.
 *
 * Eliminates boilerplate by providing:
 * - Automatic database pool acquisition
 * - Configurable auth modes (none, optional, required, admin)
 * - Per-route rate limiting
 * - Structured request logging with timing
 * - Consistent error serialization
 *
 * Usage:
 * ```ts
 * export const GET = createApiHandler({ auth: "required" }, async (req, ctx) => {
 *   const result = await ctx.pool.query("SELECT ...");
 *   return Response.json({ data: result.rows });
 * });
 * ```
 */

import { NextRequest } from "next/server";
import { Pool } from "pg";
import { getPool } from "@/lib/postgres";
import { getCurrentUser, ensureAuthSetup } from "@/lib/auth";
import { AuthUser } from "@/types";
import { ApiError, ForbiddenError, ServiceUnavailableError, UnauthorizedError, serializeError } from "./api-errors";
import { getClientIp, logRequest } from "./request-logger";
import { checkRateLimit, RateLimitConfig, RATE_LIMIT_READ, RATE_LIMIT_WRITE } from "./rate-limit";
import { verifyTrustedOrigin } from "@/lib/request-security";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthMode = "none" | "optional" | "required" | "admin";

export interface HandlerOptions {
  /** Auth requirement for this handler. Defaults to "none". */
  auth?: AuthMode;

  /**
   * Rate limit configuration. Defaults based on auth mode:
   * - "none"/"optional" → RATE_LIMIT_READ (100/min)
   * - "required"/"admin" → RATE_LIMIT_WRITE (30/min)
   *
   * Set to `false` to disable rate limiting.
   */
  rateLimit?: RateLimitConfig | false;

  /**
   * A unique key used for rate-limit bucketing.
   * Defaults to the request pathname. Override this if multiple handlers
   * share a route file (e.g., GET and POST on the same route.ts).
   */
  rateLimitKey?: string;
}

export interface HandlerContext {
  /** The database connection pool (guaranteed to be non-null). */
  pool: Pool;

  /**
   * The authenticated user.
   * - `null` when auth is "none" or "optional" with no session.
   * - Guaranteed non-null when auth is "required" or "admin".
   */
  user: AuthUser | null;
}

type Handler = (request: NextRequest, context: HandlerContext) => Promise<Response>;

// ─── Migration Memoization ────────────────────────────────────────────────────

/** We only need to run migrations once per process lifetime. */
let migrationsDone = false;

async function ensureMigrations(pool: Pool): Promise<void> {
  if (migrationsDone) return;

  await ensureAuthSetup(pool);
  migrationsDone = true;
}

// ─── Session Pruning Throttle ─────────────────────────────────────────────────

/**
 * Instead of pruning expired sessions on every auth check, we prune at most
 * once every 15 minutes. This prevents unnecessary DB writes on hot paths.
 */
let lastPruneTime = 0;
const PRUNE_INTERVAL_MS = 15 * 60_000;

async function maybePruneExpiredSessions(pool: Pool): Promise<void> {
  const now = Date.now();
  if (now - lastPruneTime < PRUNE_INTERVAL_MS) return;

  lastPruneTime = now;

  try {
    await pool.query("DELETE FROM auth_sessions WHERE expires_at <= NOW()");
  } catch (err) {
    // Session pruning is non-critical; log and move on
    console.warn("[api-handler] Failed to prune expired sessions:", err);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a Next.js route handler with built-in pool, auth, rate limiting,
 * structured logging, and error handling.
 */
export function createApiHandler(options: HandlerOptions, handler: Handler): (request: NextRequest) => Promise<Response> {
  const authMode = options.auth ?? "none";

  return async (request: NextRequest): Promise<Response> => {
    const startTime = Date.now();
    const ip = getClientIp(request);
    const path = request.nextUrl.pathname;
    let userId: string | undefined;
    let rateLimitHeaders: Record<string, string> = {};

    try {
      const originError = verifyTrustedOrigin(request);
      if (originError) {
        throw new ForbiddenError(originError);
      }

      // ── 1. Rate Limiting ──────────────────────────────────────────────
      const rateLimitConfig = options.rateLimit === false
        ? null
        : options.rateLimit ?? (authMode === "none" || authMode === "optional" ? RATE_LIMIT_READ : RATE_LIMIT_WRITE);

      if (rateLimitConfig) {
        const routeKey = options.rateLimitKey ?? `${request.method}:${path}`;
        rateLimitHeaders = checkRateLimit(ip, routeKey, rateLimitConfig);
      }

      // ── 2. Database Pool ──────────────────────────────────────────────
      const pool = getPool();
      if (!pool) {
        throw new ServiceUnavailableError("DATABASE_URL is not configured.");
      }

      // ── 3. Migrations (once per process) ──────────────────────────────
      await ensureMigrations(pool);

      // ── 4. Authentication ─────────────────────────────────────────────
      let user: AuthUser | null = null;

      if (authMode !== "none") {
        await maybePruneExpiredSessions(pool);
        user = await getCurrentUser(pool, request);

        if (authMode === "required" && !user) {
          throw new UnauthorizedError();
        }

        if (authMode === "admin") {
          if (!user) throw new UnauthorizedError();
          if (user.role !== "super_admin") {
            throw new ForbiddenError("Only admins can perform this action.");
          }
        }

        if (user) userId = user.id;
      }

      // ── 5. Execute Handler ────────────────────────────────────────────
      const response = await handler(request, { pool, user });

      // ── 6. Attach Rate Limit Headers ──────────────────────────────────
      for (const [key, value] of Object.entries(rateLimitHeaders)) {
        response.headers.set(key, value);
      }

      // ── 7. Log Success ────────────────────────────────────────────────
      logRequest({
        timestamp: new Date().toISOString(),
        method: request.method,
        path,
        status: response.status,
        durationMs: Date.now() - startTime,
        userId,
        ip,
        userAgent: request.headers.get("user-agent") ?? "",
      });

      return response;
    } catch (error) {
      // ── Error Handling ──────────────────────────────────────────────────
      const { status, body } = serializeError(error);

      logRequest({
        timestamp: new Date().toISOString(),
        method: request.method,
        path,
        status,
        durationMs: Date.now() - startTime,
        userId,
        ip,
        userAgent: request.headers.get("user-agent") ?? "",
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: error instanceof ApiError ? error.code : "INTERNAL_ERROR",
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      const responseHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...rateLimitHeaders,
      };

      if (error instanceof ApiError && "retryAfterSeconds" in error) {
        responseHeaders["Retry-After"] = String((error as { retryAfterSeconds: number }).retryAfterSeconds);
      }

      return new Response(JSON.stringify(body), {
        status,
        headers: responseHeaders,
      });
    }
  };
}
