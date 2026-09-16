/**
 * Hobby serverless entry tests. Reproduces the production headers.get crash
 * and asserts GET /health returns JSON without hanging (no DB boot).
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { GET, ensureWebRequest, vercelHandler } from "./vercel-gateway.js";

const failures: string[] = [];

function check(ok: boolean, msg: string) {
  if (ok) console.log(`ok  ${msg}`);
  else {
    failures.push(msg);
    console.error(`FAIL ${msg}`);
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isHealthJson(body: unknown): body is {
  ok: boolean;
  service: string;
  venues: string;
  matchEngine: string;
} {
  if (!body || typeof body !== "object") return false;
  const rec = body as Record<string, unknown>;
  return rec.service === "soft-spark-api" && typeof rec.venues === "string";
}

async function reproduceHeadersGetCrash() {
  console.log("reproducing production TypeError on Node-shaped headers (expected 500 from raw Hono):");
  const app = new Hono();
  app.use("/*", cors());
  app.get("/health", (c) => c.json({ ok: true }));
  const nodeish = {
    method: "GET",
    url: "https://soft-spark-api.vercel.app/health",
    headers: { host: "soft-spark-api.vercel.app" },
  };
  const result: unknown = await Promise.resolve(app.fetch(nodeish as unknown as Request)).catch(
    (err: unknown) => err
  );
  if (result instanceof Error) {
    check(
      result.message.includes("headers.get"),
      `hypothesis: Hono throws "${result.message}" on IncomingMessage-shaped headers`
    );
    return;
  }
  const status = result instanceof Response ? result.status : -1;
  check(
    status >= 500,
    `hypothesis: Hono CORS hits headers.get on Node headers (status ${status})`
  );
}

async function viaWebRequest() {
  const res = await withTimeout(
    GET(new Request("https://soft-spark-api.vercel.app/health")),
    4000,
    "GET Web Request /health"
  );
  if (!res) {
    failures.push("GET Web Request returned void");
    return;
  }
  const body: unknown = await res.json();
  check(res.status === 200, `Web Request /health status ${res.status}`);
  check(isHealthJson(body) && body.venues === "seed" && (body.matchEngine ?? "stub") === "stub", "Web Request /health JSON seed+stub");
}

async function viaBrokenNodeHeaders() {
  const nodeish = {
    method: "GET",
    url: "https://soft-spark-api.vercel.app/health",
    headers: {
      host: "soft-spark-api.vercel.app",
      "x-forwarded-proto": "https",
    },
  };
  const wrapped = ensureWebRequest(nodeish);
  check(typeof wrapped.headers.get === "function", "ensureWebRequest exposes headers.get");
  check(wrapped.headers.get("host") === "soft-spark-api.vercel.app", "ensureWebRequest copies host");

  const res = await withTimeout(GET(nodeish as unknown as Request), 4000, "GET nodeish /health");
  if (!res) {
    failures.push("GET nodeish returned void");
    return;
  }
  const body: unknown = await res.json();
  check(res.status === 200 && isHealthJson(body), "nodeish headers /health JSON 200");
}

async function viaRewriteDestination() {
  const res = await withTimeout(
    GET(
      new Request("https://soft-spark-api.vercel.app/api", {
        headers: { host: "soft-spark-api.vercel.app" },
      })
    ),
    4000,
    "GET rewrite /api"
  );
  if (!res) {
    failures.push("GET /api returned void");
    return;
  }
  const body: unknown = await res.json();
  check(res.status === 200 && isHealthJson(body), "rewrite destination GET /api serves /health JSON");
}

async function viaNodeHttpServer() {
  const server = createServer((req, res) => {
    void Promise.resolve(vercelHandler(req, res)).catch((err) => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(err instanceof Error ? err.message : "error");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const res = await withTimeout(
      fetch(`http://127.0.0.1:${port}/health`),
      4000,
      "Node http /health"
    );
    const body: unknown = await res.json();
    check(res.status === 200, `Node http /health status ${res.status}`);
    check(
      isHealthJson(body) && body.venues === "seed" && (body.matchEngine ?? "stub") === "stub",
      `Node http /health body venues=${isHealthJson(body) ? body.venues : "?"} matchEngine=${isHealthJson(body) ? body.matchEngine : "?"}`
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function viaProdSeedEnv() {
  const prev = {
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_VENUE_SEED: process.env.ALLOW_VENUE_SEED,
    MATCH_ENGINE_MODE: process.env.MATCH_ENGINE_MODE,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  };
  process.env.NODE_ENV = "production";
  process.env.ALLOW_VENUE_SEED = "1";
  process.env.MATCH_ENGINE_MODE = "stub";
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/spark";
  process.env.BETTER_AUTH_SECRET = "prod-secret-at-least-32-characters!";
  try {
    const res = await withTimeout(
      GET(new Request("https://soft-spark-api.vercel.app/health")),
      4000,
      "prod seed /health"
    );
    if (!res) {
      failures.push("prod seed GET returned void");
      return;
    }
    const body: unknown = await res.json();
    check(res.status === 200, `prod seed /health status ${res.status}`);
    check(
      isHealthJson(body) && body.ok === true && body.venues === "seed" && body.matchEngine === "stub",
      "prod seed /health { ok, venues: seed, matchEngine: stub }"
    );
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function main() {
  process.env.ALLOW_VENUE_SEED ??= "1";
  process.env.MATCH_ENGINE_MODE ??= "stub";
  await reproduceHeadersGetCrash();
  await viaBrokenNodeHeaders();
  await viaWebRequest();
  await viaRewriteDestination();
  await viaNodeHttpServer();
  await viaProdSeedEnv();

  if (failures.length) {
    console.error("\nGATEWAY TEST FAILED");
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }
  console.log("\nHobby gateway /health JSON ok (no hang, headers.get fixed)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
