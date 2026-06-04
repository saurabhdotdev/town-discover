/**
 * Standardized API error classes for consistent HTTP error handling.
 *
 * These errors are caught by `createApiHandler` and serialized to a uniform
 * response shape: `{ error: { message: string, code: string } }`.
 *
 * Internal/unexpected errors return a generic message in production.
 */

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code ?? statusCodeToCode(statusCode);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "Invalid request.") {
    super(400, message, "BAD_REQUEST");
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Please log in first.") {
    super(401, message, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "You do not have permission to perform this action.") {
    super(403, message, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "The requested resource was not found.") {
    super(404, message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message = "A conflicting resource already exists.") {
    super(409, message, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message?: string) {
    super(
      429,
      message ?? `Too many requests. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      "RATE_LIMITED"
    );
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message = "Service temporarily unavailable. Please try again later.") {
    super(503, message, "SERVICE_UNAVAILABLE");
    this.name = "ServiceUnavailableError";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusCodeToCode(status: number): string {
  switch (status) {
    case 400: return "BAD_REQUEST";
    case 401: return "UNAUTHORIZED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 429: return "RATE_LIMITED";
    case 503: return "SERVICE_UNAVAILABLE";
    default:  return "INTERNAL_ERROR";
  }
}

/**
 * Serializes an error into a safe JSON-ready object.
 * In production, internal errors are obfuscated.
 */
export function serializeError(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof ApiError) {
    const body: Record<string, unknown> = {
      error: { message: error.message, code: error.code },
    };

    if (error instanceof RateLimitError) {
      body.retryAfterSeconds = error.retryAfterSeconds;
    }

    return { status: error.statusCode, body };
  }

  // Postgres unique constraint violation → 409 Conflict
  if (isPostgresUniqueViolation(error)) {
    return {
      status: 409,
      body: { error: { message: "A conflicting resource already exists.", code: "CONFLICT" } },
    };
  }

  // Unknown errors — hide details in production
  const isDev = process.env.NODE_ENV !== "production";
  return {
    status: 500,
    body: {
      error: {
        message: isDev && error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again later.",
        code: "INTERNAL_ERROR",
      },
    },
  };
}

function isPostgresUniqueViolation(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as Record<string, unknown>).code === "23505"
  );
}
