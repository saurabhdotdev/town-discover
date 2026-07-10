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

    globalForPg.townDiscoverPgPool.on("error", (err) => {
      console.error("Unexpected error on idle pg client:", err);
    });
  }

  return globalForPg.townDiscoverPgPool;
};

export const findPlacesNearLocation = async (
  pool: Pool,
  tableName: string,
  latitude: number,
  longitude: number,
  radiusMeters: number,
  limit: number = 50
) => {
  const query = `
    SELECT *,
      ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
    FROM ${tableName}
    WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, false)
    ORDER BY location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
    LIMIT $4;
  `;
  
  const result = await pool.query(query, [longitude, latitude, radiusMeters, limit]);
  return result.rows;
};
