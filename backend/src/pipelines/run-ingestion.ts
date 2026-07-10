// backend/src/pipelines/run-ingestion.ts

import { PlaceIngester } from "./placeIngester";
import db from "../db";

const getArgs = () => {
  const args: Record<string, string> = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--")) {
      const parts = arg.slice(2).split("=");
      const key = parts[0];
      const value = parts.slice(1).join("=");
      args[key] = value;
    }
  });
  return args;
};

const main = async () => {
  const args = getArgs();
  const city = args.city || "Pune";

  const ingester = new PlaceIngester();
  
  try {
    const result = await ingester.ingestCity(city);
    
    console.log("\n==========================================");
    console.log(`✅ places Ingestion Completed for ${result.city}`);
    console.log(`📡 Ingestion Source: ${result.source}`);
    console.log(`📥 Extracted Raw Listings: ${result.extractedCount}`);
    console.log(`🧹 Cleansed & Filtered Spots: ${result.cleansedCount}`);
    console.log(`💾 Saved/Upserted DB Records: ${result.insertedCount}`);
    
    if (result.errors.length > 0) {
      console.log("\n⚠️ Encountered Warnings/Errors:");
      result.errors.forEach((err) => console.log(`  - ${err}`));
    }
    console.log("==========================================\n");
    
  } catch (error) {
    console.error("❌ Place Ingestion Pipeline crashed:", error);
  } finally {
    // End the db pg-pool connection to release the process
    await db.close();
    process.exit(0);
  }
};

main();
