import { applySchema } from "./migrate";
import { openDb } from "./client";
import { seedVenueCatalog } from "./seed-data";

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_VENUE_SEED !== "1" &&
    process.env.VENUE_MODE !== "seed"
  ) {
    console.error(
      "Venue catalog seed is blocked in production unless ALLOW_VENUE_SEED=1 or VENUE_MODE=seed. Otherwise set GOOGLE_PLACES_API_KEY for Places."
    );
    process.exit(1);
  }
  const opened = await openDb();
  await applySchema(opened.db);
  const n = await seedVenueCatalog(opened.db);
  console.log(`seeded venue catalog (${n} rows) via ${opened.kind}${opened.dataDir ? ` at ${opened.dataDir}` : ""}`);
  await opened.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
