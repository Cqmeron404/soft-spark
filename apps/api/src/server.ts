import { createApp, type AppDeps } from "./app.js";
import { bootstrap } from "./bootstrap.js";
import { maybeEnsureDemoUsers } from "./demo-users.js";
import { envFlags, validateBootEnv } from "./env.js";

export type StartedApp = {
  fetch: (request: Request) => Response | Promise<Response>;
  close: () => Promise<void>;
  flags: ReturnType<typeof envFlags>;
};

let singleton: Promise<StartedApp> | undefined;

export async function startApp(): Promise<StartedApp> {
  validateBootEnv();
  const ctx = await bootstrap();
  const deps: AppDeps = {
    store: ctx.store,
    auth: ctx.auth,
    hub: ctx.hub,
    events: ctx.events,
    db: ctx.db,
    push: ctx.push,
  };
  const app = createApp(deps);
  await maybeEnsureDemoUsers({
    app,
    auth: ctx.auth,
    db: ctx.db,
    store: ctx.store,
    events: ctx.events,
    hub: ctx.hub,
    push: ctx.push,
  });
  return {
    fetch: (request) => app.fetch(request),
    close: ctx.close,
    flags: envFlags(),
  };
}

export function getApp(): Promise<StartedApp> {
  singleton ??= startApp().catch((err) => {
    singleton = undefined;
    throw err;
  });
  return singleton;
}

/** Test helper: close PGlite/Postgres so the gateway test process can exit. */
export async function resetGetApp(): Promise<void> {
  const current = singleton;
  singleton = undefined;
  if (!current) return;
  const app = await current.catch(() => undefined);
  await app?.close();
}
