import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { bootMissing, healthPayload } from "./env.js";
import { getApp } from "./server.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type HeaderBag = Headers | Record<string, string | string[] | undefined>;
type IncomingLike = {
  method?: string;
  url?: string;
  headers?: HeaderBag;
  body?: unknown;
};

function hasHeadersGet(headers: unknown): headers is Headers {
  return Boolean(headers && typeof (headers as Headers).get === "function");
}

function headerValue(headers: HeaderBag | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  if (hasHeadersGet(headers)) return headers.get(name) ?? undefined;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  return direct;
}

function pathnameOf(url: string): string {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return new URL(url).pathname;
    }
  } catch {
    /* relative or invalid */
  }
  const path = url.split("?")[0] ?? url;
  return path.startsWith("/") ? path : `/${path}`;
}

function isHealthPath(path: string): boolean {
  return path === "/health" || path === "/api/health" || path.endsWith("/health");
}

/** Hobby rewrite sends every route to `/api`; treat that GET as `/health`. */
function isHealthAlias(path: string): boolean {
  return path === "/api" || path === "/api/" || path === "/" || isHealthPath(path);
}

function collectPaths(input: IncomingLike): string[] {
  const paths = [pathnameOf(input.url ?? "/")];
  for (const name of ["x-forwarded-uri", "x-invoke-path", "x-original-uri", "x-vercel-original-path"]) {
    const value = headerValue(input.headers, name);
    if (value) paths.push(pathnameOf(value));
  }
  return paths;
}

function toWebHeaders(headers: HeaderBag | undefined): Headers {
  if (hasHeadersGet(headers)) return headers;
  const out = new Headers();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) out.append(key, item);
    } else {
      out.set(key, value);
    }
  }
  return out;
}

function absoluteUrl(input: IncomingLike): string {
  const raw = input.url ?? "/";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const host = headerValue(input.headers, "host") ?? "localhost";
  const proto = headerValue(input.headers, "x-forwarded-proto") ?? "https";
  return `${proto}://${host}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

/** Strip the Vercel `api/` mount so `/api/health` and `/api/auth/*` match app routes. */
function unwrapApiMount(request: Request): Request {
  const url = new URL(request.url);
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    url.pathname = url.pathname.slice("/api".length) || "/";
    return new Request(url, request);
  }
  return request;
}

/**
 * Vercel Node (`framework: null`, `api/*.ts`) passes IncomingMessage whose
 * `headers` is a plain object. Hono's `c.req.header()` calls `this.raw.headers.get`.
 */
export function ensureWebRequest(input: Request | IncomingMessage | IncomingLike): Request {
  if (input instanceof Request && hasHeadersGet(input.headers)) {
    return unwrapApiMount(input);
  }
  const method = String(input.method ?? "GET").toUpperCase();
  const headers = toWebHeaders(input.headers);
  const init: RequestInit & { duplex?: "half" } = { method, headers };
  if (method !== "GET" && method !== "HEAD" && input instanceof Request && input.body) {
    init.body = input.body;
    init.duplex = "half";
  }
  return unwrapApiMount(new Request(absoluteUrl(input), init));
}

function healthStatusBody() {
  const missing = bootMissing();
  return {
    status: (missing.length ? 503 : 200) as 200 | 503,
    body: {
      ...healthPayload(),
      ok: missing.length === 0,
      bootMissing: missing.length ? missing : undefined,
    },
  };
}

const webOrigin = () => process.env.WEB_ORIGIN ?? "http://localhost:3000";
const corsMw = cors({
  origin: (origin) => origin || webOrigin(),
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization", "x-user-id"],
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
});

const gateway = new Hono();
gateway.use("/health", corsMw);

function healthRoute(c: Context) {
  const { status, body } = healthStatusBody();
  const origin = c.req.header("origin") || webOrigin();
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Credentials", "true");
  return c.json(body, status);
}

gateway.get("/health", healthRoute);
gateway.get("/api/health", healthRoute);
gateway.get("/api", healthRoute);
gateway.get("/", healthRoute);
gateway.all("*", async (c) => {
  if (collectPaths({ url: c.req.url, headers: c.req.raw.headers }).some(isHealthAlias)) {
    return healthRoute(c);
  }
  const started = await getApp();
  return started.fetch(c.req.raw);
});

const nodeListener = getRequestListener((request) => gateway.fetch(ensureWebRequest(request)));

function isNodeInvocation(
  req: IncomingMessage | Request | IncomingLike,
  res?: ServerResponse
): req is IncomingMessage {
  return Boolean(
    res &&
      typeof res.writeHead === "function" &&
      typeof (req as IncomingMessage).on === "function" &&
      typeof (req as IncomingMessage).pipe === "function"
  );
}

/** Node (req, res) Hobby functions *and* Web Request/Response invokers. */
export async function vercelHandler(
  req: IncomingMessage | Request | IncomingLike,
  res?: ServerResponse
): Promise<Response | void> {
  if (isNodeInvocation(req, res) && res) {
    return nodeListener(req, res);
  }
  return gateway.fetch(ensureWebRequest(req));
}

export default vercelHandler;
export const GET = vercelHandler;
export const POST = vercelHandler;
export const PATCH = vercelHandler;
export const PUT = vercelHandler;
export const OPTIONS = vercelHandler;
export const DELETE = vercelHandler;
