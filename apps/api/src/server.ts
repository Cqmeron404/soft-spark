import { createApp, type AppDeps } from "./app.js";
import { bootstrap } from "./bootstrap.js";
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
