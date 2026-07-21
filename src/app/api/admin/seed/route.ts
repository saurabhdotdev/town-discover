import { createApiHandler } from "@/lib/server/api-handler";
import { MOCK_PLACES } from "@/data/mock-places";
import { populateMissingEmbeddings } from "@/lib/server/rag-setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler({ auth: "admin" }, async (request, { pool }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let insertedCount = 0;

    for (const place of MOCK_PLACES) {
      await client.query(
        `
        INSERT INTO approved_places (
          id,
          title,
          description,
          category,
          image,
          rating,
          latitude,
          longitude,
          tags,
          city,
          locality,
          price_range,
          phone,
          website,
          hours,
          location
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, ST_SetSRID(ST_MakePoint($8, $7), 4326))
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          image = EXCLUDED.image,
          rating = EXCLUDED.rating,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          tags = EXCLUDED.tags,
          city = EXCLUDED.city,
          locality = EXCLUDED.locality,
          price_range = EXCLUDED.price_range,
          phone = EXCLUDED.phone,
          website = EXCLUDED.website,
          hours = EXCLUDED.hours,
          location = EXCLUDED.location
        `,
        [
          place.id,
          place.title,
          place.description,
          place.category,
          place.image,
          place.rating,
          place.latitude,
          place.longitude,
          place.tags || [],
          place.city,
          place.locality,
          place.priceRange || "$$",
          place.phone || null,
          place.website || null,
          place.hours ? JSON.stringify(place.hours) : null
        ]
      );
      insertedCount++;
    }

    await client.query("COMMIT");

    // Run embedding population in the background (fire-and-forget)
    void populateMissingEmbeddings();

    return Response.json({
      success: true,
      message: `Database successfully seeded with ${insertedCount} places.`,
      count: insertedCount,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to seed database:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error during seeding" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
});
