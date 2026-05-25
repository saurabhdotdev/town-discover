import { Pool } from "pg";

type GlobalWithPg = typeof globalThis & {
  townDiscoverPgPool?: Pool;
};

export const getPool = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return null;
  }

  const globalForPg = globalThis as GlobalWithPg;

  if (!globalForPg.townDiscoverPgPool) {
    globalForPg.townDiscoverPgPool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
    });
  }

  return globalForPg.townDiscoverPgPool;
};
