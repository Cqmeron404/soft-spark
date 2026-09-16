import { applySchema, openDb, seedVenueCatalog, type OpenDbOptions } from "@soft-spark/db";
import { createAuth } from "./auth.js";
import { allowDemoUsers, allowVenueCatalogSeed } from "./env.js";
import { ensureDemoUsers } from "./ensure-demo-users.js";
import { EventLog } from "./event-log.js";
import { createPushDispatcher, type PushDispatcher } from "./push.js";
import { createMemoryRealtimeHub } from "./realtime.js";
import { createDbStore } from "./store.js";

export type BootstrapOptions = OpenDbOptions & {
  /** Force Denver catalog seed (tests). Prod: ALLOW_VENUE_SEED=1 or VENUE_MODE=seed. */
  seedCatalog?: boolean;
  /** Idempotent Maya/Jordan Better Auth + onboard. Prod default on; soak passes false. */
  seedDemoUsers?: boolean;
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
  const events = new EventLog();
  const auth = createAuth(opened.db);
  const ctx = {
    ...opened,
    store,
    auth,
    hub,
    push,
    events,
  };
  const shouldDemo = options.seedDemoUsers ?? allowDemoUsers();
  if (shouldDemo) {
    await ensureDemoUsers(ctx);
  }
  return ctx;
}
