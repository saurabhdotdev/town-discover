// backend/src/pipelines/backfill-embeddings.ts

import { db } from "../db";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

async function backfill() {
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not defined in environment.");
    process.exit(1);
  }

  const pool = db.pool;
  console.log("🔗 Connecting to database and checking for missing embeddings...");
  
  while (true) {
    try {
      const { rows } = await pool.query(
        `SELECT id, title, category, tags, locality, description 
         FROM approved_places 
         WHERE embedding IS NULL 
         LIMIT 50`
      );

      if (rows.length === 0) {
        console.log("✅ All approved places already have vector embeddings populated!");
        break;
      }

      console.log(`🔄 Found ${rows.length} places missing embeddings. Generating batch...`);

      const requests = rows.map((place) => {
        const tagsList = Array.isArray(place.tags) ? place.tags : [];
        const textToEmbed = `Title: ${place.title}
Category: ${place.category}
Tags: ${tagsList.join(", ")}
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
          body: JSON.stringify({ requests }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ Batch embed API call failed: ${response.statusText} - ${errText}`);
        break;
      }

      const data = (await response.json()) as any;
      const embeddings = data.embeddings || [];

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let updated = 0;
        for (let i = 0; i < rows.length; i++) {
          const id = rows[i].id;
          const vals = embeddings[i]?.values;
          if (vals && vals.length === 768) {
            const vectorStr = `[${vals.join(",")}]`;
            await client.query(
              `UPDATE approved_places SET embedding = $1::vector WHERE id = $2`,
              [vectorStr, id]
            );
            updated++;
          }
        }
        await client.query("COMMIT");
        console.log(`💾 Successfully populated and saved ${updated} place embeddings.`);
      } catch (dbErr) {
        await client.query("ROLLBACK");
        console.error("❌ Database batch update failed:", dbErr);
        break;
      } finally {
        client.release();
      }

      // Sleep 35 seconds to avoid hitting Gemini Free Tier 100 RPM rate limit
      console.log("💤 Sleeping 35s to avoid hitting Gemini rate limits...");
      await new Promise((r) => setTimeout(r, 35000));
    } catch (err: any) {
      console.error("❌ Embeddings loop encountered an error:", err.message || err);
      break;
    }
  }

  await db.close();
  process.exit(0);
}

backfill();
