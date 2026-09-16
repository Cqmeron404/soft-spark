import { sql } from "drizzle-orm";
import type { SparkDb } from "./client";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL,
    image TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "session" (
    id TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "account" (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    password TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "verification" (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS "users" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    interested_in TEXT[] NOT NULL,
    bio TEXT,
    photo_url TEXT,
    home_lat DOUBLE PRECISION NOT NULL,
    home_lng DOUBLE PRECISION NOT NULL,
    home_tz TEXT NOT NULL DEFAULT 'America/Denver',
    bot_dating_opt_in BOOLEAN NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "dating_bots" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "users"(id),
    vibe_tags TEXT[] NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    paused BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "preferences" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "users"(id),
    cuisine TEXT[] NOT NULL,
    budget INTEGER NOT NULL,
    max_travel_km INTEGER NOT NULL,
    dealbreakers TEXT[] NOT NULL,
    looking_for TEXT NOT NULL DEFAULT 'unsure',
    interests TEXT[] NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "matches" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL REFERENCES "users"(id),
    user_b_id UUID NOT NULL REFERENCES "users"(id),
    state TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    band TEXT NOT NULL,
    reasons TEXT[] NOT NULL,
    safety_ok BOOLEAN NOT NULL DEFAULT true,
    profile_fit DOUBLE PRECISION NOT NULL DEFAULT 0,
    chemistry DOUBLE PRECISION NOT NULL DEFAULT 0,
    logistics DOUBLE PRECISION NOT NULL DEFAULT 0,
    chemistry_dims JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "conversations" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES "matches"(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "messages" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES "conversations"(id),
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    safety_ok BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "venues" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cuisine TEXT NOT NULL,
    price_tier INTEGER NOT NULL,
    approx_neighborhood TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL DEFAULT 'stub'
  )`,
  `CREATE TABLE IF NOT EXISTS "venue_catalog" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cuisine TEXT NOT NULL,
    price_tier INTEGER NOT NULL,
    approx_neighborhood TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL DEFAULT 'catalog'
  )`,
  `CREATE TABLE IF NOT EXISTS "invites" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES "matches"(id),
    venue_id UUID NOT NULL REFERENCES "venues"(id),
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    window_label TEXT NOT NULL,
    time_zone TEXT NOT NULL DEFAULT 'America/Denver',
    status TEXT NOT NULL DEFAULT 'pending',
    user_a_status TEXT NOT NULL DEFAULT 'waiting',
    user_b_status TEXT NOT NULL DEFAULT 'waiting',
    travel_km_a DOUBLE PRECISION NOT NULL,
    travel_km_b DOUBLE PRECISION NOT NULL,
    why TEXT NOT NULL,
    carry_cue_a TEXT,
    carry_cue_b TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "push_devices" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    endpoint TEXT,
    p256dh TEXT,
    auth TEXT,
    expo_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

/** Additive columns for existing Hobby / PGlite databases (CREATE TABLE IF NOT EXISTS will not alter). */
const ALTERS = [
  `ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS carry_cue_a TEXT`,
  `ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS carry_cue_b TEXT`,
];

export async function applySchema(db: SparkDb): Promise<void> {
  for (const statement of STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
  for (const statement of ALTERS) {
    try {
      await db.execute(sql.raw(statement));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`soft-spark-db: schema alter skipped (${message})`);
    }
  }
}
