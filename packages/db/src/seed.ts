import { applySchema } from "./migrate";
import { openDb } from "./client";
import { seedVenueCatalog } from "./seed-data";

async function main() {
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
