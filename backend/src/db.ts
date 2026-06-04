import { Pool, QueryResult } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL?.includes("localhost") ||
    process.env.DATABASE_URL?.includes("127.0.0.1")
      ? false
      : {
          rejectUnauthorized:
            process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
        },
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
});

// Handle unexpected errors on idle pool clients to prevent process crashes
pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle database client:", err.message || err);
});

export const db = {
  query: <T extends Record<string, any> = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> => {
    return pool.query<T>(text, params);
  },
  connect: () => pool.connect(),
  pool,
  close: async () => {
    console.log("📡 Shutting down database connection pool...");
    await pool.end();
  },
};

export default db;
