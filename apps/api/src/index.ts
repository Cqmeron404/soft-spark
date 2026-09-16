import { serve } from "@hono/node-server";
import { getApp } from "./server.js";

const port = Number(process.env.PORT ?? 8787);

const started = await getApp();
serve({ fetch: started.fetch, port }, () => {
  const flags = started.flags;
  console.log(
    `soft-spark api listening on http://localhost:${port} (prod=${flags.production} db=${flags.database} places=${flags.places} llm=${flags.llm} webPush=${flags.webPush})`
  );
});
