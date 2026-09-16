/** Production boot + feature flags. Never invent credentials. */

import {
  assertPlacesKeyInProd,
  isForcedSeedVenueMode,
  resolveVenueMode,
  type VenueMode,
} from "@soft-spark/match-engine";

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
  venues: VenueMode;
  llm: boolean;
  webPush: boolean;
  expoPush: boolean;
  demoUsers: boolean;
};

export function envFlags(env: NodeJS.ProcessEnv = process.env): EnvFlagReport {
  const secret = authSecret(env);
  return {
    production: isProduction(env),
    database: isPostgresUrl(env.DATABASE_URL),
    authSecret: Boolean(secret) && secret !== DEV_AUTH_SECRET,
    places: Boolean(env.GOOGLE_PLACES_API_KEY),
    venues: resolveVenueMode(env),
    llm: env.MATCH_ENGINE_MODE === "llm" && Boolean(env.OPENAI_API_KEY),
    webPush: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    expoPush: true,
    demoUsers: allowDemoUsers(env),
  };
}

export type HealthPayload = {
  ok: boolean;
  service: "soft-spark-api";
  authMode: "prod" | "dev";
  matchEngine: string;
  venues: VenueMode;
  env: {
    database: boolean;
    authSecret: boolean;
    places: boolean;
    llm: boolean;
    webPush: boolean;
    demoUsers: boolean;
  };
  bootMissing?: string[];
};

/** Public /health body. Booleans + venue mode only — never secret values. */
export function healthPayload(env: NodeJS.ProcessEnv = process.env): HealthPayload {
  const flags = envFlags(env);
  return {
    ok: true,
    service: "soft-spark-api",
    authMode: env.AUTH_MODE === "prod" || env.NODE_ENV === "production" ? "prod" : "dev",
    matchEngine: env.MATCH_ENGINE_MODE ?? "stub",
    venues: flags.venues,
    env: {
      database: flags.database,
      authSecret: flags.authSecret,
      places: flags.places,
      llm: flags.llm,
      webPush: flags.webPush,
      demoUsers: flags.demoUsers,
    },
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

/** Places key required in prod behind VenueSuggester unless seed catalog is allowed. */
export function placesMissing(env: NodeJS.ProcessEnv = process.env): string[] {
  if (!isProduction(env)) return [];
  if (isForcedSeedVenueMode(env)) return [];
  if (!env.GOOGLE_PLACES_API_KEY) return ["GOOGLE_PLACES_API_KEY"];
  return [];
}

export function assertPlacesInProd(
  env: NodeJS.ProcessEnv = process.env,
  options?: { emptyVenues?: boolean }
): void {
  assertPlacesKeyInProd(env, { empty: options?.emptyVenues });
}

export function allowVenueCatalogSeed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isProduction(env)) return true;
  return isForcedSeedVenueMode(env);
}

/**
 * Maya/Jordan one-tap accounts. Default ON so live Hobby demos work after
 * merge + API redeploy with no extra Vercel env. Set ALLOW_DEMO_USERS=0 to disable.
 */
export function allowDemoUsers(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.ALLOW_DEMO_USERS?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

export const GO_LIVE_SECRETS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "WEB_ORIGIN",
  "ALLOW_VENUE_SEED=1 or VENUE_MODE=seed (or GOOGLE_PLACES_API_KEY)",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "OPENAI_API_KEY (only if MATCH_ENGINE_MODE=llm)",
] as const;
