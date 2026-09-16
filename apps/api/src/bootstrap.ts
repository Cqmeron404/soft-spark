import { applySchema, openDb, seedVenueCatalog, type OpenDbOptions } from "@soft-spark/db";
import { createAuth } from "./auth.js";
import { allowVenueCatalogSeed } from "./env.js";
import { EventLog } from "./event-log.js";
import { createPushDispatcher, type PushDispatcher } from "./push.js";
import { createMemoryRealtimeHub } from "./realtime.js";
import { createDbStore } from "./store.js";

export type BootstrapOptions = OpenDbOptions & {
  /** Force Denver catalog seed (tests). Ignored in prod unless ALLOW_VENUE_SEED=1. */
  seedCatalog?: boolean;
};

export async function bootstrap(options: BootstrapOptions = {}) {
  const opened = await openDb(options);
  await applySchema(opened.db);
  const shouldSeed = options.seedCatalog ?? allowVenueCatalogSeed();
  if (shouldSeed) {
    await seedVenueCatalog(opened.db);
  }
  const store = createDbStore(opened.db);
  const push: PushDispatcher = createPushDispatcher(store);
  const hub = createMemoryRealtimeHub();
  return {
    ...opened,
    store,
    auth: createAuth(opened.db),
    hub,
    push,
    events: new EventLog(),
  };
}
