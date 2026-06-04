import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import crypto from "crypto";

// Import local components
import db from "./db";
import { runDatabaseMigrations } from "./migrations";
import { authenticateUser, requireUser, AuthenticatedUser } from "./middleware/auth";
import { apiLimiter, reportPostLimiter } from "./middleware/rateLimiter";
import { getAllowedOrigins, requireTrustedOrigin } from "./middleware/security";
import { validateRequest } from "./middleware/validate";
import { errorHandler } from "./middleware/errors";
import { requestTimeout } from "./middleware/timeout";
import {
  getCrowdReportsSchema,
  postCrowdReportSchema,
} from "./schemas/crowdReport";
import { requestLogger } from "./middleware/logger";

// Load environment variables from frontend env.local first for convenience
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config(); // Fallback to backend .env

const app: Application = express();

// Background database cleanup worker state
let cleanupInterval: NodeJS.Timeout | null = null;
let keepAliveInterval: NodeJS.Timeout | null = null;
const PORT = process.env.PORT || 5000;
const allowedOrigins = getAllowedOrigins();
const corsOrigin = (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
  if (!origin) {
    callback(null, process.env.NODE_ENV !== "production");
    return;
  }

  callback(null, allowedOrigins.has(origin));
};

// Create HTTP Server for Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Parse cookie strings manually (for Socket.io handshakes)
const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookieStr) => {
    const parts = cookieStr.split("=");
    const name = parts[0]?.trim();
    const value = parts.slice(1).join("=").trim();
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
};

const hashSessionToken = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("base64url");
};

// Middleware setup
app.use(compression());
app.use(requestLogger);
app.use(requestTimeout(15000)); // 15-second request timeout limit
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" })); // Secure urlencoded payload limit
app.use(cookieParser());
app.use("/api/", requireTrustedOrigin);

// Rate Limiter
app.use("/api/", apiLimiter);

// Database setup SQL configurations
const activeWindowSql = "NOW() - INTERVAL '45 minutes'";
const cooldownWindowSql = "NOW() - INTERVAL '10 minutes'";
const cooldownMinutes = 10;

// SQL Helper functions
const pruneExpiredReports = async () => {
  await db.query(`DELETE FROM crowd_reports WHERE reported_at < ${activeWindowSql}`);
};

const startCleanupInterval = () => {
  // Prune once immediately on boot to clear out stale reports
  pruneExpiredReports().catch((err) => {
    console.error("❌ Startup database cleanup failed:", err.message || err);
  });

  // Run cleanup every 5 minutes
  cleanupInterval = setInterval(async () => {
    try {
      console.log("🧹 Running background database cleanup for expired crowd reports...");
      await pruneExpiredReports();
      console.log("🧹 Background database cleanup completed successfully.");
    } catch (error: any) {
      console.error("❌ Background database cleanup failed:", error.message || error);
    }
  }, 5 * 60 * 1000);

  // Allow server shutdown without waiting for this interval
  cleanupInterval.unref();
};

const summariesSql = (whereClause: string) => `
WITH ranked_reports AS (
  SELECT
    place_id,
    reported_at,
    ROW_NUMBER() OVER (
      PARTITION BY place_id, COALESCE(user_id::text, id::text)
      ORDER BY reported_at DESC
    ) AS report_rank,
    CASE crowd_level
      WHEN 'low' THEN 1
      WHEN 'moderate' THEN 2
      WHEN 'busy' THEN 3
      WHEN 'very_crowded' THEN 4
    END AS crowd_score
  FROM crowd_reports
  WHERE reported_at >= ${activeWindowSql}
  ${whereClause}
),
active_reports AS (
  SELECT place_id, reported_at, crowd_score
  FROM ranked_reports
  WHERE report_rank = 1
),
summary AS (
  SELECT
    place_id,
    COUNT(*)::int AS report_count,
    AVG(crowd_score)::float AS average_score,
    MAX(reported_at) AS latest_reported_at
  FROM active_reports
  GROUP BY place_id
)
SELECT
  place_id AS "placeId",
  CASE
    WHEN average_score IS NULL THEN NULL
    WHEN average_score < 1.5 THEN 'low'
    WHEN average_score < 2.5 THEN 'moderate'
    WHEN average_score < 3.5 THEN 'busy'
    ELSE 'very_crowded'
  END AS "crowdLevel",
  report_count AS "reportCount",
  ROUND(average_score::numeric, 2)::float AS "averageScore",
  latest_reported_at AS "latestReportedAt"
FROM summary
ORDER BY latest_reported_at DESC
`;

const getPlaceSummary = async (placeId: string) => {
  const { rows } = await db.query(summariesSql("AND place_id = $1"), [placeId]);
  return (
    rows[0] ?? {
      placeId,
      crowdLevel: null,
      reportCount: 0,
      averageScore: null,
      latestReportedAt: null,
    }
  );
};

// Health Check Route
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "Sheher API is alive ✨", realTimeConnected: io.engine.clientsCount });
});

// GET crowd reports
app.get(
  "/api/crowd-reports",
  validateRequest(getCrowdReportsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const { placeId, placeIds } = req.query as any;

    try {
      if (placeIds) {
        const idsArray = placeIds
          .split(",")
          .map((id: string) => id.trim())
          .filter(Boolean)
          .slice(0, 80);

        if (idsArray.length > 0) {
          const { rows } = await db.query(
            summariesSql("AND place_id = ANY($1::text[])"),
            [idsArray]
          );
          const summariesById = Object.fromEntries(
            rows.map((row) => [row.placeId, row])
          );
          res.json({ summaries: summariesById });
          return;
        }
      }

      if (!placeId) {
        const { rows } = await db.query(summariesSql(""));
        res.json({ summaries: rows });
        return;
      }

      const reportsResult = await db.query(
        `
        WITH ranked_reports AS (
          SELECT
            id,
            place_id,
            crowd_level,
            note,
            reported_at,
            ROW_NUMBER() OVER (
              PARTITION BY place_id, COALESCE(user_id::text, id::text)
              ORDER BY reported_at DESC
            ) AS report_rank
          FROM crowd_reports
          WHERE place_id = $1
            AND reported_at >= ${activeWindowSql}
        )
        SELECT
          id,
          place_id AS "placeId",
          crowd_level AS "crowdLevel",
          note,
          reported_at AS "reportedAt"
        FROM ranked_reports
        WHERE report_rank = 1
        ORDER BY reported_at DESC
        LIMIT 12
        `,
        [placeId]
      );

      const summary = await getPlaceSummary(placeId);
      res.json({
        summary,
        reports: reportsResult.rows,
        report: reportsResult.rows[0] ?? null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST crowd reports
app.post(
  "/api/crowd-reports",
  reportPostLimiter,
  authenticateUser,
  requireUser,
  validateRequest(postCrowdReportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const { placeId, crowdLevel, note } = req.body;
    const user = req.user!;

    try {
      // Check Cooldown
      const recentReportResult = await db.query(
        `
        SELECT
          id,
          EXTRACT(EPOCH FROM (reported_at + INTERVAL '10 minutes' - NOW()))::int AS retry_after_seconds
        FROM crowd_reports
        WHERE place_id = $1
          AND user_id = $2
          AND reported_at > ${cooldownWindowSql}
        ORDER BY reported_at DESC
        LIMIT 1
        `,
        [placeId, user.id]
      );

      if (recentReportResult.rows[0]) {
        const retryAfterSeconds = Math.max(
          1,
          recentReportResult.rows[0].retry_after_seconds ?? cooldownMinutes * 60
        );
        const summary = await getPlaceSummary(placeId);
        res.status(429).json({
          error: `You already reported this place. You can update your crowd report in ${Math.ceil(
            retryAfterSeconds / 60
          )} min.`,
          retryAfterSeconds,
          summary,
        });
        return;
      }

      const client = await db.connect();
      let report;

      try {
        await client.query("BEGIN");
        await client.query(
          "DELETE FROM crowd_reports WHERE place_id = $1 AND user_id = $2",
          [placeId, user.id]
        );
        const { rows } = await client.query(
          `
          INSERT INTO crowd_reports (place_id, crowd_level, note, user_id)
          VALUES ($1, $2, NULLIF($3, ''), $4)
          RETURNING
            id,
            place_id AS "placeId",
            crowd_level AS "crowdLevel",
            note,
            reported_at AS "reportedAt"
          `,
          [placeId, crowdLevel, note || null, user.id]
        );
        await client.query("COMMIT");
        report = rows[0];
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      const summary = await getPlaceSummary(placeId);

      // Broadcast update
      io.emit("crowd-update", { placeId, summary, report });

      res.status(201).json({ report, summary });
    } catch (error) {
      next(error);
    }
  }
);

// GET active flash deals
app.get(
  "/api/deals/active",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await db.query(
        `
        SELECT 
          id, 
          place_id AS "placeId", 
          place_title AS "placeTitle", 
          discount_percentage AS "discountPercentage", 
          description, 
          expires_at AS "expiresAt"
        FROM flash_deals
        WHERE expires_at > NOW()
        ORDER BY created_at DESC
        `
      );
      res.json({ success: true, deals: rows });
    } catch (error) {
      next(error);
    }
  }
);

// POST launch new flash deal (Simulated merchant endpoint)
app.post(
  "/api/deals/launch",
  authenticateUser,
  requireUser,
  async (req: Request, res: Response, next: NextFunction) => {
    const { placeId, placeTitle, discountPercentage, description } = req.body;
    try {
      const expiresAt = new Date(Date.now() + 45 * 60 * 1000); // 45 mins expiry
      const { rows } = await db.query(
        `
        INSERT INTO flash_deals (place_id, place_title, discount_percentage, description, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, place_id AS "placeId", place_title AS "placeTitle", discount_percentage AS "discountPercentage", description, expires_at AS "expiresAt"
        `,
        [placeId, placeTitle, discountPercentage, description || "", expiresAt]
      );
      const deal = rows[0];
      io.emit("new-flash-deal", deal);
      res.status(201).json({ success: true, deal });
    } catch (error) {
      next(error);
    }
  }
);

// POST subscribe to premium pass
app.post(
  "/api/auth/subscribe",
  authenticateUser,
  requireUser,
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;
    try {
      await db.query(
        `UPDATE users SET is_premium_pass = TRUE WHERE id = $1`,
        [user.id]
      );
      res.json({ success: true, message: "Subscription activated successfully! ✨" });
    } catch (error) {
      next(error);
    }
  }
);

// Socket.io handshake cookie authentication middleware
io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookies(cookieHeader);
    const token = cookies["town_discover_session"];

    if (token) {
      const { rows } = await db.query<AuthenticatedUser>(
        `
        SELECT
          users.id,
          users.email,
          users.full_name AS "fullName",
          users.role,
          users.is_premium_pass AS "isPremiumPass"
        FROM auth_sessions
        JOIN users ON users.id = auth_sessions.user_id
        WHERE auth_sessions.token_hash = $1
          AND auth_sessions.expires_at > NOW()
        LIMIT 1
        `,
        [hashSessionToken(token)]
      );
      
      if (rows[0]) {
        socket.data.user = rows[0];
        console.log(`🔌 Secure socket connection established for user: ${rows[0].email}`);
      }
    }
    next();
  } catch (error) {
    console.error("❌ Socket authentication error:", error);
    next(); // Fallback gracefully to anonymous socket
  }
});

// Socket.io connection setup
io.on("connection", (socket) => {
  socket.on("join-place", (placeId: string) => {
    socket.join(placeId);
  });

  socket.on("leave-place", (placeId: string) => {
    socket.leave(placeId);
  });
});

// Centralized error handler middleware (must be registered last)
app.use(errorHandler);

// Database connection retry loop helper
const connectWithRetry = async (retries = 5, delayMs = 3000): Promise<void> => {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`📡 Connecting to database (Attempt ${i}/${retries})...`);
      const client = await db.connect();
      client.release();
      console.log("📡 Database connection established successfully.");
      return;
    } catch (error: any) {
      console.error(`❌ Connection attempt ${i} failed:`, error.message || error);
      if (i < retries) {
        console.log(`📡 Retrying database connection in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        throw new Error("Could not connect to database after maximum retries.");
      }
    }
  }
};

// Start Server
let server: ReturnType<typeof httpServer.listen> | null = null;

const startServer = async () => {
  // Ensure DB connection is established with retry logic
  await connectWithRetry();
  
  await runDatabaseMigrations(db.pool);
  startCleanupInterval();

  // Start 60-second database keep-alive ping loop
  keepAliveInterval = setInterval(async () => {
    try {
      await db.query("SELECT 1");
    } catch (err) {
      console.warn("⚠️ [DB Keep-Alive] Failed to ping database:", err);
    }
  }, 60000);

  server = httpServer.listen(PORT, () => {
    console.log(`🚀 Sheher API Server running on port ${PORT}`);
    console.log(`📡 Real-time Socket.io active`);
  });
};

// Graceful Shutdown Logic
const shutdown = async (signal: string) => {
  console.log(`\n📡 Received ${signal}. Beginning graceful shutdown...`);
  
  // Stop background cleanups
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    console.log("📡 Background cleanup interval stopped.");
  }

  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    console.log("📡 Database keep-alive interval stopped.");
  }

  // Close Socket.io server explicitly to drain active websocket connections
  io.close(() => {
    console.log("📡 Socket.io server closed.");
  });

  // Close HTTP server from receiving new requests
  server?.close(() => {
    console.log("📡 HTTP server closed.");
  });

  // Close database pool connection pool
  await db.close();

  console.log("👋 Graceful shutdown complete.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Process-wide unhandled errors handlers (prevent process-level raw crashes)
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  shutdown("unhandledRejection");
});

startServer().catch(async (error) => {
  console.error("Failed to start Sheher API Server:", error);
  await db.close();
  process.exit(1);
});
