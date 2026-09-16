import { Hono } from "hono";
import { handle } from "hono/vercel";
import { bootMissing, healthPayload } from "./env.js";
import { getApp } from "./server.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isHealthPath(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return path === "/health" || path.endsWith("/health");
  } catch {
    return false;
  }
}

const gateway = new Hono();
gateway.all("*", async (c) => {
  if (isHealthPath(c.req.url)) {
    try {
      const started = await getApp();
      return started.fetch(c.req.raw);
    } catch (err) {
      const missing = bootMissing();
      return Response.json(
        {
          ...healthPayload(),
          ok: false,
          bootMissing: missing.length ? missing : undefined,
          error: missing.length ? undefined : err instanceof Error ? err.message : "boot_failed",
        },
        { status: missing.length ? 503 : 500 }
      );
    }
  }
  const started = await getApp();
  return started.fetch(c.req.raw);
});

export default handle(gateway);
export const GET = handle(gateway);
export const POST = handle(gateway);
export const PATCH = handle(gateway);
export const PUT = handle(gateway);
export const OPTIONS = handle(gateway);
export const DELETE = handle(gateway);
