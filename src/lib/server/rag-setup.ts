import { getPool } from "@/lib/postgres";

export async function populateMissingEmbeddings() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("RAG Setup: GEMINI_API_KEY not configured, skipping embedding population.");
    return;
  }

  const pool = getPool();
  if (!pool) return;

  try {
    // Find up to 50 places that do not have embeddings
    const { rows } = await pool.query(
      `SELECT id, title, category, tags, locality, description 
       FROM approved_places 
       WHERE embedding IS NULL 
       LIMIT 50`
    );

    if (rows.length === 0) {
      return;
    }

    console.log(`RAG Setup: Found ${rows.length} places missing embeddings. Generating...`);

    const requests = rows.map((place) => {
      const textToEmbed = `Title: ${place.title}
Category: ${place.category}
Tags: ${(place.tags || []).join(", ")}
Locality: ${place.locality || "unknown"}
Description: ${place.description || ""}`;
      return {
        model: "models/gemini-embedding-001",
        content: {
          parts: [{ text: textToEmbed }]
        },
        outputDimensionality: 768
      };
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ requests }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to batch embed: ${response.statusText}`);
    }

    const data = await response.json();
    const embeddings = data.embeddings || [];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < rows.length; i++) {
        const id = rows[i].id;
        const vals = embeddings[i]?.values;
        if (vals && vals.length === 768) {
          const vectorStr = `[${vals.join(",")}]`;
          await client.query(
            `UPDATE approved_places SET embedding = $1::vector WHERE id = $2`,
            [vectorStr, id]
          );
        }
      }
      await client.query("COMMIT");
      console.log(`RAG Setup: Successfully populated ${rows.length} place embeddings.`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("RAG Setup: Failed to populate missing embeddings:", err);
  }
}
