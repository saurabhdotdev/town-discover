import dotenv from "dotenv";
import path from "path";

// Load environment variables first
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config();

import db from "../db";

async function getEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const requests = texts.map((text) => ({
    model: "models/gemini-embedding-001",
    content: {
      parts: [{ text }]
    },
    outputDimensionality: 768
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ requests }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to batch embed: ${response.status} - ${errText}`);
  }

  const data = (await response.json()) as any;
  const embeddings = data.embeddings || [];
  return embeddings.map((e: any) => e.values);
}

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY is not set.");
    process.exit(1);
  }

  const client = await db.connect();

  try {
    console.log("📡 Connected to database. Querying places missing embeddings...");

    // Check count first
    const { rows: countResult } = await client.query(
      "SELECT count(*)::int as count FROM approved_places WHERE embedding IS NULL"
    );
    const totalMissing = countResult[0].count;
    console.log(`📊 Found ${totalMissing} places missing embeddings.`);

    if (totalMissing === 0) {
      console.log("✅ All places already have embeddings!");
      return;
    }

    let processed = 0;
    const batchSize = 30; // Reduced from 50 to avoid hitting rate limits
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    while (true) {
      const { rows: places } = await client.query(
        `SELECT id, title, category, tags, locality, description 
         FROM approved_places 
         WHERE embedding IS NULL 
         LIMIT $1`,
         [batchSize]
      );

      if (places.length === 0) {
        break;
      }

      console.log(`⚙️ Processing batch of ${places.length} places (${processed + 1} - ${processed + places.length})...`);

      const texts = places.map((place) => {
        return `Title: ${place.title}
Category: ${place.category}
Tags: ${(place.tags || []).join(", ")}
Locality: ${place.locality || "unknown"}
Description: ${place.description || ""}`;
      });

      try {
        const embeddings = await getEmbeddings(texts, apiKey);

        await client.query("BEGIN");
        for (let i = 0; i < places.length; i++) {
          const id = places[i].id;
          const vals = embeddings[i];
          if (vals && vals.length === 768) {
            const vectorStr = `[${vals.join(",")}]`;
            await client.query(
              `UPDATE approved_places SET embedding = $1::vector WHERE id = $2`,
              [vectorStr, id]
            );
          }
        }
        await client.query("COMMIT");

        processed += places.length;
        console.log(`   ✅ Saved ${places.length} embeddings. (Total: ${processed}/${totalMissing})`);

        if (processed < totalMissing) {
          console.log("   ⏳ Sleeping for 20 seconds to respect rate limits...");
          await sleep(20000);
        }

      } catch (batchErr) {
        await client.query("ROLLBACK");
        console.error("   ❌ Failed to process batch:", batchErr);
        break; // Stop loop on error
      }
    }

    console.log(`\n🎉 Completed embedding generation. Populated ${processed} places.`);

  } catch (err) {
    console.error("❌ Pipeline failed:", err);
  } finally {
    client.release();
    await db.close();
  }
}

run();
