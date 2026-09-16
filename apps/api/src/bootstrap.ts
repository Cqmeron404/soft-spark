import { applySchema, openDb, seedVenueCatalog, type OpenDbOptions } from "@soft-spark/db";
import { createAuth } from "./auth.js";
import { EventLog } from "./event-log.js";
import { createMemoryRealtimeHub } from "./realtime.js";
import { createDbStore } from "./store.js";

export async function bootstrap(options: OpenDbOptions = {}) {
  const opened = await openDb(options);
  await applySchema(opened.db);
  await seedVenueCatalog(opened.db);
  return {
    ...opened,
    store: createDbStore(opened.db),
    auth: createAuth(opened.db),
    hub: createMemoryRealtimeHub(),
    events: new EventLog(),
  };
}
