import { Hono } from "hono";
import { handle } from "hono/vercel";
import { getApp } from "../src/server.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const gateway = new Hono();
gateway.all("*", async (c) => {
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
