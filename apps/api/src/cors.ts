import { cors } from "hono/cors";

export const CORS_ALLOW_HEADERS = ["Content-Type", "Authorization", "x-user-id"] as const;
export const CORS_ALLOW_METHODS = [
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
  "OPTIONS",
  "HEAD",
] as const;

/** Strip whitespace / trailing slashes so env and the browser Origin header match. */
export function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function webOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.WEB_ORIGIN ?? "http://localhost:3000";
  const origins = raw.split(",").map(normalizeOrigin).filter(Boolean);
  return origins.length ? origins : ["http://localhost:3000"];
}

export function trustedAuthOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return [...webOrigins(env), "softspark://", "exp://"];
}

/**
 * Credentialed CORS cannot use `*`. Echo WEB_ORIGIN only when it matches the request.
 * Reflecting any Origin (previous behavior) is incorrect for cookies and hides misconfigured env.
 */
export function corsAllowOrigin(
  origin: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  if (!origin) return undefined;
  const normalized = normalizeOrigin(origin);
  return webOrigins(env).includes(normalized) ? normalized : undefined;
}

export function isCrossSiteAuth(env: NodeJS.ProcessEnv = process.env): boolean {
  const web = webOrigins(env)[0] ?? "http://localhost:3000";
  const api = env.BETTER_AUTH_URL ?? env.API_URL ?? "http://localhost:8787";
  try {
    return new URL(web).origin !== new URL(api).origin;
  } catch {
    return normalizeOrigin(web) !== normalizeOrigin(api);
  }
}

export function honoCors(env: NodeJS.ProcessEnv = process.env) {
  return cors({
    origin: (origin) => corsAllowOrigin(origin, env),
    credentials: true,
    allowHeaders: [...CORS_ALLOW_HEADERS],
    allowMethods: [...CORS_ALLOW_METHODS],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
  });
}
