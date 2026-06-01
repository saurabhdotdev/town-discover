import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";

// Import local components
import db from "./db";
import { authenticateUser, requireUser } from "./middleware/auth";
import { apiLimiter, reportPostLimiter } from "./middleware/rateLimiter";
import { getAllowedOrigins, requireTrustedOrigin } from "./middleware/security";
import { validateRequest } from "./middleware/validate";
import { errorHandler } from "./middleware/errors";
import {
  getCrowdReportsSchema,
  postCrowdReportSchema,
} from "./schemas/crowdReport";

// Load environment variables from frontend env.local first for convenience
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config(); // Fallback to backend .env

const app: Application = express();
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

// Middleware
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "64kb" }));
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
      await pruneExpiredReports();

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
      await pruneExpiredReports();

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

// Start Server
const server = httpServer.listen(PORT, () => {
  console.log(`🚀 Sheher API Server running on port ${PORT}`);
  console.log(`📡 Real-time Socket.io active`);
});

// Graceful Shutdown Logic
const shutdown = async (signal: string) => {
  console.log(`\n📡 Received ${signal}. Beginning graceful shutdown...`);
  
  // Close HTTP and Socket.io server
  server.close(() => {
    console.log("📡 HTTP server closed.");
  });

  // Close database pool connection
  await db.close();

  console.log("👋 Graceful shutdown complete.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
