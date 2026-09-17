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

/** Hobby prod web. */
export const SOFT_SPARK_WEB_HOST = "soft-spark.vercel.app";
/** Do not treat the API host as a browser Origin. */
export const SOFT_SPARK_API_HOST = "soft-spark-api.vercel.app";
/** Vercel team slug on Soft Spark Hobby preview hostnames. */
export const SOFT_SPARK_VERCEL_TEAM = "cameronjgroff-2605";
/**
 * Better Auth wildcard for this team's Soft Spark web previews / aliases.
 * Not `*.vercel.app`, not other Vercel teams.
 */
export const SOFT_SPARK_VERCEL_PREVIEW_ORIGIN_PATTERN =
  `https://soft-spark-*-${SOFT_SPARK_VERCEL_TEAM}.vercel.app`;

/** Strip whitespace / trailing slashes so env and the browser Origin header match. */
export function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function webOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.WEB_ORIGIN ?? "http://localhost:3000";
  const origins = raw.split(",").map(normalizeOrigin).filter(Boolean);
  return origins.length ? origins : ["http://localhost:3000"];
}

/**
 * HTTPS Soft Spark web on vercel.app: prod host plus this team's preview aliases.
 * Rejects other vercel.app apps, other teams, and the API host.
 */
export function isSoftSparkVercelWebOrigin(origin: string): boolean {
  let host: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    host = url.hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === SOFT_SPARK_WEB_HOST) return true;
  if (host === SOFT_SPARK_API_HOST || host.startsWith("soft-spark-api")) return false;
  const previewSuffix = `-${SOFT_SPARK_VERCEL_TEAM}.vercel.app`;
  if (!host.startsWith("soft-spark-") || !host.endsWith(previewSuffix)) return false;
  const label = host.slice(0, -".vercel.app".length);
  return label.length > "soft-spark-".length && !label.includes(".");
}

export function trustedAuthOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const extras = [
    `https://${SOFT_SPARK_WEB_HOST}`,
    SOFT_SPARK_VERCEL_PREVIEW_ORIGIN_PATTERN,
    "softspark://",
    "exp://",
  ];
  const origins = webOrigins(env);
  const seen = new Set(origins);
  for (const extra of extras) {
    if (seen.has(extra)) continue;
    origins.push(extra);
    seen.add(extra);
  }
  return origins;
}

/**
 * Credentialed CORS cannot use `*`. Echo WEB_ORIGIN or a Soft Spark Vercel
 * preview origin. Reflecting any Origin is incorrect for cookies.
 */
export function corsAllowOrigin(
  origin: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  if (!origin) return undefined;
  const normalized = normalizeOrigin(origin);
  if (webOrigins(env).includes(normalized)) return normalized;
  if (isSoftSparkVercelWebOrigin(normalized)) return normalized;
  return undefined;
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
