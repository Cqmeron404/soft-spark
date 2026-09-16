import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { Hono } from "hono";
import type { Context } from "hono";
import { corsAllowOrigin, honoCors } from "./cors.js";
import {
  bootMissing,
  healthPayload,
  INTERNAL_JOB_HEADER,
  internalJobAuthorized,
  internalRoutesLocked,
} from "./env.js";
import { getApp } from "./server.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type HeaderBag = Headers | Record<string, string | string[] | undefined> | IncomingHttpHeaders;
type IncomingLike = {
  method?: string;
  url?: string;
  headers?: HeaderBag;
  body?: unknown;
};

const HOP_BY_HOP = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);

function bodyReadTimeoutMs(): number {
  const raw = Number(process.env.BODY_READ_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 5000;
}

function hasHeadersGet(headers: unknown): headers is Headers {
  return Boolean(headers && typeof (headers as Headers).get === "function");
}

function headerValue(headers: HeaderBag | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  if (hasHeadersGet(headers)) return headers.get(name) ?? undefined;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  return typeof direct === "string" ? direct : undefined;
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

/** Hobby rewrite sends every GET to `/api`; treat that GET as `/health`. */
function isHealthAlias(path: string): boolean {
  return path === "/api" || path === "/api/" || path === "/" || isHealthPath(path);
}

function stripApiMountPath(path: string): string {
  if (path === "/api" || path === "/api/") return "/";
  if (path.startsWith("/api/")) return path.slice("/api".length) || "/";
  return path;
}

function isInternalEventsPath(path: string): boolean {
  const p = stripApiMountPath(path).replace(/\/+$/, "") || "/";
  return p === "/internal/events";
}

function isInternalOrchestratePath(path: string): boolean {
  const p = stripApiMountPath(path).replace(/\/+$/, "") || "/";
  return p === "/internal/orchestrate";
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
  if (hasHeadersGet(headers)) return new Headers(headers);
  const out = new Headers();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value === undefined) continue;
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
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

function cloneRequest(url: URL | string, request: Request, body?: RequestInit["body"]): Request {
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: request.headers,
  };
  const resolved = body === undefined ? request.body : body;
  if (resolved) {
    init.body = resolved;
    if (typeof resolved === "object" && "getReader" in (resolved as object)) {
      init.duplex = "half";
    }
  }
  return new Request(url, init);
}

function contentLengthOf(headers: HeaderBag | undefined): number | undefined {
  const raw = headerValue(headers, "content-length");
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function preexistingBody(input: IncomingLike): Buffer | undefined {
  const body = input.body;
  if (typeof body === "string") return Buffer.from(body);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  return undefined;
}

function isReadableIncoming(input: unknown): input is IncomingMessage {
  const stream = input as IncomingMessage;
  return Boolean(
    stream &&
      typeof stream.on === "function" &&
      typeof stream.pipe === "function" &&
      typeof stream.read === "function"
  );
}

/**
 * Fully buffer a Node IncomingMessage. Vercel Hobby IncomingMessage +
 * `Readable.toWeb` / `duplex: 'half'` never emits `end`, so `request.json()`
 * hangs until the function timeout. Content-Length 0 must not wait on the stream.
 */
export async function readIncomingBody(
  req: IncomingMessage | IncomingLike,
  options: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<Buffer> {
  const timeoutMs = options.timeoutMs ?? bodyReadTimeoutMs();
  const maxBytes = options.maxBytes ?? 1_048_576;
  const existing = preexistingBody(req);
  if (existing) return existing;

  if (!isReadableIncoming(req)) return Buffer.alloc(0);

  if (req.readableEnded || (req.complete && req.readableLength === 0)) {
    return Buffer.alloc(0);
  }

  const declared = contentLengthOf(req.headers);
  if (declared === 0) {
    return Buffer.alloc(0);
  }

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onErr);
      if (err) reject(err);
      else resolve(Buffer.concat(chunks));
    };
    const timer = setTimeout(() => {
      if (chunks.length === 0) {
        console.warn(
          `soft-spark-api: request body read timed out after ${timeoutMs}ms (content-length=${declared ?? "none"})`
        );
      }
      finish();
    }, timeoutMs);
    const onData = (chunk: Buffer | string) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size > maxBytes) {
        finish(new Error("request body too large"));
        req.destroy?.();
        return;
      }
      chunks.push(buf);
      if (declared !== undefined && size >= declared) finish();
    };
    const onEnd = () => finish();
    const onErr = (err: Error) => finish(err);
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onErr);
    req.resume();
  });
}

function requestFromBuffer(url: string, method: string, headers: Headers, body: Buffer): Request {
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  const init: RequestInit = { method, headers };
  if (body.length) init.body = new Uint8Array(body);
  return unwrapApiMount(new Request(url, init));
}

export async function nodeToWebRequest(input: IncomingMessage | IncomingLike): Promise<Request> {
  const method = String(input.method ?? "GET").toUpperCase();
  const headers = toWebHeaders(input.headers);
  if (method === "GET" || method === "HEAD") {
    return unwrapApiMount(new Request(absoluteUrl(input), { method, headers }));
  }
  const body = await readIncomingBody(input);
  return requestFromBuffer(absoluteUrl(input), method, headers, body);
}

async function bufferFetchRequest(request: Request): Promise<Request> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return unwrapApiMount(request);
  }
  if (!request.body) {
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.delete("transfer-encoding");
    return unwrapApiMount(new Request(request.url, { method, headers }));
  }
  const timeoutMs = bodyReadTimeoutMs();
  try {
    const body = await Promise.race([
      request.arrayBuffer(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("body-timeout")), timeoutMs);
      }),
    ]);
    return requestFromBuffer(request.url, method, new Headers(request.headers), Buffer.from(body));
  } catch (err) {
    if (err instanceof Error && err.message === "body-timeout") {
      console.warn(`soft-spark-api: Fetch Request body timed out after ${timeoutMs}ms`);
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      headers.delete("transfer-encoding");
      request.body.cancel?.().catch(() => undefined);
      return unwrapApiMount(new Request(request.url, { method, headers }));
    }
    throw err;
  }
}

/** Convert Hobby Node or Fetch input into a Request whose body is fully buffered. */
export async function toBufferedWebRequest(input: Request | IncomingMessage | IncomingLike): Promise<Request> {
  if (isReadableIncoming(input) && !(input instanceof Request)) {
    return nodeToWebRequest(input);
  }
  if (input instanceof Request && hasHeadersGet(input.headers)) {
    return bufferFetchRequest(input);
  }
  return nodeToWebRequest(input);
}

/** Strip the Vercel `api/` mount so `/api/health` and `/api/auth/*` match app routes. */
function unwrapApiMount(request: Request): Request {
  const url = new URL(request.url);
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    url.pathname = url.pathname.slice("/api".length) || "/";
    return cloneRequest(url, request);
  }
  return request;
}

/**
 * Vercel Node (`framework: null`, `api/*.ts`) passes IncomingMessage whose
 * `headers` is a plain object. Hono's `c.req.header()` calls `this.raw.headers.get`.
 * POST/PATCH bodies must be **buffered** — streaming via `Readable.toWeb` hangs
 * `request.json()` on Hobby until timeout.
 */
export function ensureWebRequest(input: Request | IncomingMessage | IncomingLike): Request {
  if (input instanceof Request && hasHeadersGet(input.headers)) {
    return unwrapApiMount(input);
  }
  const method = String(input.method ?? "GET").toUpperCase();
  const headers = toWebHeaders(input.headers);
  const init: RequestInit & { duplex?: "half" } = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    const existing = preexistingBody(input);
    if (existing?.length) {
      headers.delete("content-length");
      init.body = new Uint8Array(existing);
    } else if (isReadableIncoming(input) && !input.readableEnded && contentLengthOf(input.headers) !== 0) {
      // Sync fallback for tests that already have a finite Readable (e.g. Readable.from).
      init.body = Readable.toWeb(input) as unknown as ReadableStream;
      init.duplex = "half";
    } else {
      headers.delete("content-length");
      headers.delete("transfer-encoding");
    }
  }
  return unwrapApiMount(new Request(absoluteUrl(input), init));
}

async function writeNodeResponse(res: ServerResponse, response: Response): Promise<void> {
  const skip = new Set(["set-cookie", ...HOP_BY_HOP]);
  response.headers.forEach((value, key) => {
    if (skip.has(key.toLowerCase())) return;
    res.setHeader(key, value);
  });
  const cookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  if (cookies.length === 1) res.setHeader("set-cookie", cookies[0] ?? "");
  else if (cookies.length > 1) res.setHeader("set-cookie", cookies);
  res.statusCode = response.status;
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf.length ? buf : undefined);
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

const corsMw = honoCors();

function applyHealthCors(c: Context) {
  const allow = corsAllowOrigin(c.req.header("origin"));
  if (allow) {
    c.header("Access-Control-Allow-Origin", allow);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin");
  }
}

const gateway = new Hono();
/** Preflight and error responses must not wait on Postgres. */
gateway.use("*", corsMw);

function healthRoute(c: Context) {
  const { status, body } = healthStatusBody();
  applyHealthCors(c);
  return c.json(body, status);
}

gateway.get("/health", healthRoute);
gateway.get("/api/health", healthRoute);
gateway.get("/api", healthRoute);
gateway.get("/", healthRoute);
gateway.onError((err, c) => {
  const allow = corsAllowOrigin(c.req.header("origin"));
  if (allow) {
    c.header("Access-Control-Allow-Origin", allow);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin");
  }
  const message = err instanceof Error ? err.message : "error";
  return c.json({ error: message }, 500);
});
gateway.all("*", async (c) => {
  const method = c.req.method;
  const paths = collectPaths({ url: c.req.url, headers: c.req.raw.headers });
  const healthOnly = method === "GET" || method === "HEAD";
  if (healthOnly && paths.some(isHealthAlias)) {
    return healthRoute(c);
  }
  if (paths.some(isHealthPath)) {
    return healthRoute(c);
  }
  if (internalRoutesLocked() && paths.some(isInternalEventsPath)) {
    return c.json({ error: "not_found" }, 404);
  }
  if (
    internalRoutesLocked() &&
    paths.some(isInternalOrchestratePath) &&
    !internalJobAuthorized(c.req.header(INTERNAL_JOB_HEADER))
  ) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const started = await getApp();
  return started.fetch(c.req.raw);
});

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

async function handleNode(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const request = await nodeToWebRequest(req);
    const response = await gateway.fetch(request);
    await writeNodeResponse(res, response);
  } catch (err) {
    if (res.headersSent) return;
    const origin = corsAllowOrigin(headerValue(req.headers, "origin"));
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : "error" }));
  }
}

/** Node (req, res) Hobby functions *and* Web Request/Response invokers. */
export async function vercelHandler(
  req: IncomingMessage | Request | IncomingLike,
  res?: ServerResponse
): Promise<Response | void> {
  if (isNodeInvocation(req, res) && res) {
    await handleNode(req, res);
    return;
  }
  return gateway.fetch(await toBufferedWebRequest(req));
}

export default vercelHandler;
export const GET = vercelHandler;
export const POST = vercelHandler;
export const PATCH = vercelHandler;
export const PUT = vercelHandler;
export const OPTIONS = vercelHandler;
export const DELETE = vercelHandler;
