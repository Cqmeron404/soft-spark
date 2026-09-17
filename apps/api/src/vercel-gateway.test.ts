/**
 * Hobby serverless entry tests. Reproduces the production headers.get crash
 * and asserts GET /health returns JSON without hanging (no DB boot).
 * Also: OPTIONS /auth/* CORS for WEB_ORIGIN without booting Postgres,
 * IncomingMessage POST bodies are buffered (Hobby Readable.toWeb hangs),
 * and POST /auth/sign-up/email returns HTTP quickly instead of waiting on json().
 */
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Readable } from "node:stream";
import { GET, OPTIONS, POST, ensureWebRequest, readIncomingBody, vercelHandler } from "./vercel-gateway.js";
import { corsAllowOrigin } from "./cors.js";
import { INTERNAL_JOB_HEADER } from "./env.js";
import { resetGetApp } from "./server.js";

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

async function viaProdInternalLockNoDb() {
  const prev = {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_MODE: process.env.AUTH_MODE,
    INTERNAL_JOB_SECRET: process.env.INTERNAL_JOB_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  };
  process.env.NODE_ENV = "production";
  delete process.env.AUTH_MODE;
  delete process.env.INTERNAL_JOB_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
  try {
    const events = await withTimeout(
      GET(new Request("https://soft-spark-api.vercel.app/internal/events")),
      4000,
      "prod GET /internal/events (no DB)"
    );
    if (!events) {
      failures.push("prod GET /internal/events returned void");
      return;
    }
    const eventsBody = (await events.json().catch(() => ({}))) as { error?: string };
    check(events.status === 404, `prod GET /internal/events status ${events.status} (no Postgres boot)`);
    check(eventsBody.error === "not_found", `prod GET /internal/events body ${JSON.stringify(eventsBody)}`);

    const rewritten = await withTimeout(
      GET(new Request("https://soft-spark-api.vercel.app/api/internal/events")),
      4000,
      "prod GET /api/internal/events"
    );
    if (!rewritten) {
      failures.push("prod GET /api/internal/events returned void");
    } else {
      check(rewritten.status === 404, `prod GET /api/internal/events status ${rewritten.status}`);
    }

    const orch = await withTimeout(
      POST(
        new Request("https://soft-spark-api.vercel.app/internal/orchestrate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      ),
      4000,
      "prod POST /internal/orchestrate unauth"
    );
    if (!orch) {
      failures.push("prod POST /internal/orchestrate returned void");
      return;
    }
    const orchBody = (await orch.json().catch(() => ({}))) as { error?: string };
    check(orch.status === 401, `prod POST /internal/orchestrate status ${orch.status}`);
    check(orchBody.error === "unauthorized", `prod POST /internal/orchestrate body ${JSON.stringify(orchBody)}`);

    process.env.INTERNAL_JOB_SECRET = "gateway-internal-job-test-secret";
    const wrong = await withTimeout(
      POST(
        new Request("https://soft-spark-api.vercel.app/internal/orchestrate", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [INTERNAL_JOB_HEADER]: "nope",
          },
          body: "{}",
        })
      ),
      4000,
      "prod POST /internal/orchestrate wrong secret"
    );
    if (!wrong) {
      failures.push("prod wrong-secret orchestrate returned void");
    } else {
      check(wrong.status === 401, `prod POST /internal/orchestrate wrong secret status ${wrong.status}`);
    }

    if (prev.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev.NODE_ENV;
    delete process.env.INTERNAL_JOB_SECRET;
    process.env.AUTH_MODE = "prod";
    const authMode = await withTimeout(
      GET(new Request("https://soft-spark-api.vercel.app/internal/events")),
      4000,
      "AUTH_MODE=prod GET /internal/events"
    );
    if (!authMode) {
      failures.push("AUTH_MODE=prod GET /internal/events returned void");
    } else {
      check(authMode.status === 404, `AUTH_MODE=prod GET /internal/events status ${authMode.status}`);
    }
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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

async function viaAuthPreflightNoDb() {
  const prev = {
    NODE_ENV: process.env.NODE_ENV,
    WEB_ORIGIN: process.env.WEB_ORIGIN,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  };
  process.env.NODE_ENV = "production";
  process.env.WEB_ORIGIN = "https://soft-spark.vercel.app";
  process.env.BETTER_AUTH_URL = "https://soft-spark-api.vercel.app";
  process.env.DATABASE_URL = "postgres://user:pass@127.0.0.1:1/spark";
  process.env.BETTER_AUTH_SECRET = "prod-secret-at-least-32-characters!";
  try {
    const previewOrigin =
      "https://soft-spark-git-cursor-soft-spark-roam-1c98a3-cameronjgroff-2605.vercel.app";
    check(
      corsAllowOrigin("https://soft-spark.vercel.app") === "https://soft-spark.vercel.app",
      "corsAllowOrigin allows WEB_ORIGIN"
    );
    check(
      corsAllowOrigin("https://soft-spark.vercel.app/") === "https://soft-spark.vercel.app",
      "corsAllowOrigin ignores trailing slash"
    );
    check(corsAllowOrigin(previewOrigin) === previewOrigin, "corsAllowOrigin allows Soft Spark Vercel preview");
    check(corsAllowOrigin("https://evil.example") === undefined, "corsAllowOrigin rejects other origins");
    check(corsAllowOrigin("https://evil.vercel.app") === undefined, "corsAllowOrigin rejects other vercel.app apps");
    check(
      corsAllowOrigin("https://soft-spark-api.vercel.app") === undefined,
      "corsAllowOrigin rejects the API host as a web Origin"
    );

    const res = await withTimeout(
      OPTIONS(
        new Request("https://soft-spark-api.vercel.app/auth/sign-up/email", {
          method: "OPTIONS",
          headers: {
            Origin: "https://soft-spark.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
          },
        })
      ),
      4000,
      "OPTIONS /auth preflight (no DB)"
    );
    if (!res) {
      failures.push("OPTIONS /auth returned void");
      return;
    }
    check(res.status === 204, `OPTIONS /auth status ${res.status}`);
    check(
      res.headers.get("access-control-allow-origin") === "https://soft-spark.vercel.app",
      `OPTIONS /auth ACAO ${res.headers.get("access-control-allow-origin")}`
    );
    check(
      res.headers.get("access-control-allow-credentials") === "true",
      "OPTIONS /auth Allow-Credentials"
    );
    check(
      (res.headers.get("access-control-allow-methods") ?? "").includes("POST"),
      `OPTIONS /auth Allow-Methods ${res.headers.get("access-control-allow-methods")}`
    );
    check(
      (res.headers.get("access-control-allow-headers") ?? "").toLowerCase().includes("content-type"),
      `OPTIONS /auth Allow-Headers ${res.headers.get("access-control-allow-headers")}`
    );

    const rewritten = await withTimeout(
      OPTIONS(
        new Request("https://soft-spark-api.vercel.app/api/auth/sign-up/email", {
          method: "OPTIONS",
          headers: {
            Origin: "https://soft-spark.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
          },
        })
      ),
      4000,
      "OPTIONS /api/auth preflight (rewrite mount)"
    );
    if (!rewritten) {
      failures.push("OPTIONS /api/auth returned void");
    } else {
      check(
        rewritten.status === 204 &&
          rewritten.headers.get("access-control-allow-origin") === "https://soft-spark.vercel.app",
        `OPTIONS /api/auth rewrite CORS status=${rewritten.status} ACAO=${rewritten.headers.get("access-control-allow-origin")}`
      );
    }

    const preview = await withTimeout(
      OPTIONS(
        new Request("https://soft-spark-api.vercel.app/auth/sign-up/email", {
          method: "OPTIONS",
          headers: {
            Origin: previewOrigin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
          },
        })
      ),
      4000,
      "OPTIONS /auth preview origin"
    );
    if (!preview) {
      failures.push("OPTIONS /auth preview origin returned void");
    } else {
      check(
        preview.status === 204 && preview.headers.get("access-control-allow-origin") === previewOrigin,
        `OPTIONS /auth preview CORS status=${preview.status} ACAO=${preview.headers.get("access-control-allow-origin")}`
      );
    }

    const denied = await withTimeout(
      OPTIONS(
        new Request("https://soft-spark-api.vercel.app/auth/sign-up/email", {
          method: "OPTIONS",
          headers: {
            Origin: "https://evil.example",
            "Access-Control-Request-Method": "POST",
          },
        })
      ),
      4000,
      "OPTIONS /auth untrusted origin"
    );
    if (!denied) {
      failures.push("OPTIONS untrusted origin returned void");
      return;
    }
    check(
      denied.headers.get("access-control-allow-origin") !== "https://evil.example",
      "OPTIONS /auth does not echo untrusted Origin"
    );
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function viaEnsureWebRequestPostBody() {
  const payload = { email: "cors-probe@softspark.dev", password: "spark-demo-probe1", name: "Probe" };
  const incoming = Readable.from([Buffer.from(JSON.stringify(payload))]) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  incoming.method = "POST";
  incoming.url = "/auth/sign-up/email";
  incoming.headers = {
    host: "soft-spark-api.vercel.app",
    "content-type": "application/json",
    origin: "https://soft-spark.vercel.app",
  };
  const wrapped = ensureWebRequest(incoming);
  const json = (await withTimeout(wrapped.json(), 2000, "POST body json")) as typeof payload;
  check(json.email === payload.email, "ensureWebRequest copies IncomingMessage POST JSON body");
}

async function viaNodeHttpAuthPreflight() {
  const prevOrigin = process.env.WEB_ORIGIN;
  process.env.WEB_ORIGIN = "https://soft-spark.vercel.app";
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
      fetch(`http://127.0.0.1:${port}/auth/sign-up/email`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://soft-spark.vercel.app",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      }),
      4000,
      "Node http OPTIONS /auth"
    );
    check(res.status === 204, `Node http OPTIONS /auth status ${res.status}`);
    check(
      res.headers.get("access-control-allow-origin") === "https://soft-spark.vercel.app",
      `Node http OPTIONS /auth ACAO ${res.headers.get("access-control-allow-origin")}`
    );
    check(res.headers.get("access-control-allow-credentials") === "true", "Node http OPTIONS credentials");
  } finally {
    if (prevOrigin === undefined) delete process.env.WEB_ORIGIN;
    else process.env.WEB_ORIGIN = prevOrigin;
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

function hungIncoming(headers: Record<string, string>, method = "POST", url = "/auth/sign-up/email") {
  const stream = new Readable({
    read() {
      /* never push — Vercel IncomingMessage + Readable.toWeb never ends */
    },
  }) as Readable & { method: string; url: string; headers: Record<string, string> };
  stream.method = method;
  stream.url = url;
  stream.headers = {
    host: "soft-spark-api.vercel.app",
    "x-forwarded-proto": "https",
    origin: "https://soft-spark.vercel.app",
    "content-type": "application/json",
    ...headers,
  };
  return stream;
}

function mockServerRes(): {
  res: ServerResponse;
  done: Promise<{ status: number; headers: Record<string, string | string[]>; body: string }>;
} {
  const headers: Record<string, string | string[]> = {};
  const chunks: Buffer[] = [];
  let resolveDone!: (value: { status: number; headers: Record<string, string | string[]>; body: string }) => void;
  const done = new Promise<{ status: number; headers: Record<string, string | string[]>; body: string }>((resolve) => {
    resolveDone = resolve;
  });
  const res = {
    statusCode: 200,
    headersSent: false,
    writeHead(status: number, maybe?: Record<string, string | string[]>) {
      this.statusCode = status;
      this.headersSent = true;
      if (maybe) {
        for (const [key, value] of Object.entries(maybe)) headers[key.toLowerCase()] = value;
      }
      return this;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      headers[name.toLowerCase()] = typeof value === "number" ? String(value) : (value as string | string[]);
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    write(chunk: unknown) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    },
    end(chunk?: unknown) {
      if (chunk) this.write(chunk);
      this.headersSent = true;
      resolveDone({
        status: this.statusCode,
        headers,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      return this;
    },
  };
  return { res: res as unknown as ServerResponse, done };
}

async function reproduceReadableToWebHang() {
  const hung = new Readable({
    read() {
      /* never ends */
    },
  });
  const request = new Request("https://soft-spark-api.vercel.app/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "50" },
    body: Readable.toWeb(hung) as unknown as ReadableStream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const result = await Promise.race([
    request.json().then(
      () => "resolved" as const,
      () => "rejected" as const
    ),
    new Promise<"hung">((resolve) => setTimeout(() => resolve("hung"), 400)),
  ]);
  check(
    result === "hung",
    `hypothesis: Request.json() on Readable.toWeb(never-ending stream) ${result}`
  );
}

async function viaHungIncomingBodyRead() {
  const started = Date.now();
  const buf = await withTimeout(
    readIncomingBody(hungIncoming({ "content-length": "0" })),
    1000,
    "readIncomingBody content-length 0"
  );
  check(buf.length === 0, "content-length 0 does not wait on hung IncomingMessage");
  check(Date.now() - started < 500, `content-length 0 body read finished in ${Date.now() - started}ms`);

  process.env.BODY_READ_TIMEOUT_MS = "250";
  try {
    const timed = Date.now();
    const partial = await withTimeout(
      readIncomingBody(hungIncoming({ "content-length": "80" })),
      2000,
      "readIncomingBody hung content-length 80"
    );
    check(partial.length === 0, "timed-out hung stream yields empty buffer, not a wait-forever");
    const elapsed = Date.now() - timed;
    check(elapsed >= 200 && elapsed < 1500, `hung body timeout elapsed ${elapsed}ms`);
  } finally {
    delete process.env.BODY_READ_TIMEOUT_MS;
  }
}

async function withPgliteAuthEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prev = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    WEB_ORIGIN: process.env.WEB_ORIGIN,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    ALLOW_VENUE_SEED: process.env.ALLOW_VENUE_SEED,
    MATCH_ENGINE_MODE: process.env.MATCH_ENGINE_MODE,
    PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR,
    BODY_READ_TIMEOUT_MS: process.env.BODY_READ_TIMEOUT_MS,
    ALLOW_DEMO_USERS: process.env.ALLOW_DEMO_USERS,
  };
  delete process.env.DATABASE_URL;
  delete process.env.NODE_ENV;
  process.env.WEB_ORIGIN = "https://soft-spark.vercel.app";
  process.env.BETTER_AUTH_URL = "https://soft-spark-api.vercel.app";
  process.env.ALLOW_VENUE_SEED = "1";
  process.env.MATCH_ENGINE_MODE = "stub";
  process.env.ALLOW_DEMO_USERS = "0";
  process.env.PGLITE_DATA_DIR = `.data/pglite-gateway-${process.pid}`;
  try {
    return await fn();
  } finally {
    await resetGetApp();
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function viaHungIncomingAuthPost() {
  await withPgliteAuthEnv(async () => {
    process.env.BODY_READ_TIMEOUT_MS = "250";
    const { res, done } = mockServerRes();
    const started = Date.now();
    await withTimeout(
      Promise.resolve(vercelHandler(hungIncoming({ "content-length": "0" }), res)),
      8000,
      "hung CL=0 POST /auth via Node handler"
    );
    const out = await withTimeout(done, 8000, "hung CL=0 response");
    const elapsed = Date.now() - started;
    check(out.status >= 400 && out.status < 500, `hung CL=0 POST /auth status ${out.status} (must not hang)`);
    check(elapsed < 7000, `hung CL=0 POST /auth returned in ${elapsed}ms`);
    const acao = out.headers["access-control-allow-origin"];
    check(
      acao === "https://soft-spark.vercel.app",
      `hung CL=0 POST /auth CORS ACAO ${String(acao)}`
    );
  });
}

async function viaNodeHttpAuthPost() {
  await withPgliteAuthEnv(async () => {
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
      const health = await withTimeout(fetch(`http://127.0.0.1:${port}/health`), 4000, "health after auth env");
      const healthBody: unknown = await health.json();
      check(health.status === 200 && isHealthJson(healthBody), "POST-suite /health still JSON 200");

      const empty = await withTimeout(
        fetch(`http://127.0.0.1:${port}/auth/sign-up/email`, {
          method: "POST",
          headers: {
            Origin: "https://soft-spark.vercel.app",
            "content-type": "application/json",
          },
          body: "",
        }),
        8000,
        "POST /auth/sign-up/email empty body"
      );
      check(
        empty.status >= 400 && empty.status < 500,
        `empty POST /auth status ${empty.status} (4xx, not hang)`
      );
      check(
        empty.headers.get("access-control-allow-origin") === "https://soft-spark.vercel.app",
        `empty POST /auth ACAO ${empty.headers.get("access-control-allow-origin")}`
      );

      const email = `probe-${Date.now()}@softspark.dev`;
      const res = await withTimeout(
        POST(
          new Request("https://soft-spark-api.vercel.app/auth/sign-up/email", {
            method: "POST",
            headers: {
              origin: "https://soft-spark.vercel.app",
              "content-type": "application/json",
            },
            body: JSON.stringify({ email, password: "spark-demo-probe1", name: "Probe" }),
          })
        ),
        8000,
        "POST Web Request /auth/sign-up/email"
      );
      if (!res) {
        failures.push("POST Web Request /auth returned void");
        return;
      }
      const webJson = (await res.json().catch(() => ({}))) as { user?: { email?: string }; message?: string };
      check(
        res.status === 200 || res.status === 201,
        `Web Request POST /auth status ${res.status} body=${JSON.stringify(webJson).slice(0, 180)}`
      );
      check(webJson.user?.email === email || Boolean(webJson.user), "Web Request POST /auth returns user");
      check(
        res.headers.get("access-control-allow-origin") === "https://soft-spark.vercel.app",
        `Web Request POST /auth ACAO ${res.headers.get("access-control-allow-origin")}`
      );

      const nodeRes = await withTimeout(
        fetch(`http://127.0.0.1:${port}/auth/sign-up/email`, {
          method: "POST",
          headers: {
            Origin: "https://soft-spark.vercel.app",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            email: `node-${Date.now()}@softspark.dev`,
            password: "spark-demo-probe1",
            name: "NodeProbe",
          }),
        }),
        8000,
        "Node http POST /auth/sign-up/email"
      );
      const nodeJson = (await nodeRes.json().catch(() => ({}))) as { user?: { id?: string; email?: string } };
      check(
        nodeRes.status === 200 || nodeRes.status === 201,
        `Node http POST /auth status ${nodeRes.status} body=${JSON.stringify(nodeJson).slice(0, 180)}`
      );
      check(Boolean(nodeJson.user?.id), "Node http POST /auth returns user id");
      check(
        nodeRes.headers.get("access-control-allow-origin") === "https://soft-spark.vercel.app",
        `Node http POST /auth ACAO ${nodeRes.headers.get("access-control-allow-origin")}`
      );
      const setCookie = nodeRes.headers.get("set-cookie") ?? "";
      check(
        setCookie.toLowerCase().includes("better-auth") || setCookie.length > 0,
        `Node http POST /auth Set-Cookie present (${setCookie.slice(0, 80)})`
      );

      const orch = await withTimeout(
        fetch(`http://127.0.0.1:${port}/internal/orchestrate`, {
          method: "POST",
          headers: {
            Origin: "https://soft-spark.vercel.app",
            "content-type": "application/json",
          },
          body: JSON.stringify({}),
        }),
        8000,
        "Node http POST /internal/orchestrate"
      );
      check(
        orch.status >= 400 && orch.status < 500,
        `POST /internal/orchestrate status ${orch.status} (body read, not hang)`
      );
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });
}

async function main() {
  process.env.ALLOW_VENUE_SEED ??= "1";
  process.env.MATCH_ENGINE_MODE ??= "stub";
  await reproduceHeadersGetCrash();
  await viaBrokenNodeHeaders();
  await viaWebRequest();
  await viaRewriteDestination();
  await viaNodeHttpServer();
  await viaProdInternalLockNoDb();
  await viaProdSeedEnv();
  await viaAuthPreflightNoDb();
  await viaEnsureWebRequestPostBody();
  await viaNodeHttpAuthPreflight();
  await reproduceReadableToWebHang();
  await viaHungIncomingBodyRead();
  await viaHungIncomingAuthPost();
  await viaNodeHttpAuthPost();

  if (failures.length) {
    console.error("\nGATEWAY TEST FAILED");
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }
  console.log("\nHobby gateway /health JSON + POST /auth not hanging (headers.get + body buffer)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
