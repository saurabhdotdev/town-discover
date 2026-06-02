/**
 * Structured JSON request logger for Next.js API routes.
 *
 * Outputs a single JSON line per request with timing, status, auth context,
 * and error details. Stack traces are included only in development.
 */

export interface RequestLogEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userId?: string;
  ip: string;
  userAgent: string;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Extracts the client IP from a Next.js request.
 * Checks x-forwarded-for first (reverse proxies / Vercel), falls back to
 * x-real-ip, then to a generic unknown.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may contain a comma-separated list; take the first (client) IP
    return forwarded.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Logs a completed request in structured JSON format.
 */
export function logRequest(entry: RequestLogEntry): void {
  const level = entry.status >= 500 ? "error" : entry.status >= 400 ? "warn" : "info";

  const log: Record<string, unknown> = {
    level,
    timestamp: entry.timestamp,
    method: entry.method,
    path: entry.path,
    status: entry.status,
    durationMs: entry.durationMs,
    ip: entry.ip,
  };

  if (entry.userId) log.userId = entry.userId;
  if (entry.userAgent) log.userAgent = entry.userAgent;

  if (entry.error) {
    log.error = entry.error.message;
    if (entry.error.code) log.errorCode = entry.error.code;

    // Include stack traces only in development
    if (process.env.NODE_ENV !== "production" && entry.error.stack) {
      log.stack = entry.error.stack;
    }
  }

  // Use the appropriate console method for the level
  if (level === "error") {
    console.error(JSON.stringify(log));
  } else if (level === "warn") {
    console.warn(JSON.stringify(log));
  } else {
    console.log(JSON.stringify(log));
  }
}
