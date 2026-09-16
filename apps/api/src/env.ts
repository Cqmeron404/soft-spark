/** Production boot + feature flags. Never invent credentials. */

export const DEV_AUTH_SECRET = "soft-spark-dev-secret-change-me-32chars!!";

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}

export function isPostgresUrl(url: string | undefined): url is string {
  if (!url) return false;
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

export function authSecret(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.BETTER_AUTH_SECRET ?? env.AUTH_SECRET;
}

export type EnvFlagReport = {
  production: boolean;
  database: boolean;
  authSecret: boolean;
  places: boolean;
  llm: boolean;
  webPush: boolean;
  expoPush: boolean;
};

export function envFlags(env: NodeJS.ProcessEnv = process.env): EnvFlagReport {
  const secret = authSecret(env);
  return {
    production: isProduction(env),
    database: isPostgresUrl(env.DATABASE_URL),
    authSecret: Boolean(secret) && secret !== DEV_AUTH_SECRET,
    places: Boolean(env.GOOGLE_PLACES_API_KEY),
    llm: env.MATCH_ENGINE_MODE === "llm" && Boolean(env.OPENAI_API_KEY),
    webPush: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    expoPush: true,
  };
}

/** Slice 3 deploy AC: prod boot requires DATABASE_URL + BETTER_AUTH_SECRET. */
export function bootMissing(env: NodeJS.ProcessEnv = process.env): string[] {
  if (!isProduction(env)) return [];
  const missing: string[] = [];
  if (!isPostgresUrl(env.DATABASE_URL)) missing.push("DATABASE_URL");
  const secret = authSecret(env);
  if (!secret || secret === DEV_AUTH_SECRET) missing.push("BETTER_AUTH_SECRET");
  return missing;
}

export function validateBootEnv(env: NodeJS.ProcessEnv = process.env): void {
  const missing = bootMissing(env);
  if (missing.length) {
    throw new Error(
      `Production boot requires ${missing.join(" + ")}. Set them in the host (Vercel/Fly/Render) — do not commit secrets.`
    );
  }
}

/** Places AC: GOOGLE_PLACES_API_KEY required in prod behind VenueSuggester. */
export function placesMissing(env: NodeJS.ProcessEnv = process.env): string[] {
  if (!isProduction(env)) return [];
  if (!env.GOOGLE_PLACES_API_KEY) return ["GOOGLE_PLACES_API_KEY"];
  return [];
}

export function assertPlacesInProd(
  env: NodeJS.ProcessEnv = process.env,
  options?: { emptyVenues?: boolean }
): void {
  if (options?.emptyVenues) return;
  const missing = placesMissing(env);
  if (missing.length) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY required when NODE_ENV=production (VenueSuggester). Seed catalog is local/demo only."
    );
  }
}

export function allowVenueCatalogSeed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isProduction(env)) return true;
  return env.ALLOW_VENUE_SEED === "1";
}

export const GO_LIVE_SECRETS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "WEB_ORIGIN",
  "GOOGLE_PLACES_API_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "OPENAI_API_KEY (only if MATCH_ENGINE_MODE=llm)",
] as const;
