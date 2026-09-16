import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { bootstrap } from "./bootstrap.js";

const port = Number(process.env.PORT ?? 8787);

const ctx = await bootstrap();
const app = createApp({
  store: ctx.store,
  auth: ctx.auth,
  hub: ctx.hub,
  events: ctx.events,
  db: ctx.db,
});

serve({ fetch: app.fetch, port }, () => {
  console.log(
    `soft-spark api listening on http://localhost:${port} (${ctx.kind}${ctx.dataDir ? ` ${ctx.dataDir}` : ""})`
  );
});
