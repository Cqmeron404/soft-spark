import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Better Auth core tables (drizzle adapter, provider: pg). */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authId: text("auth_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  interestedIn: text("interested_in").array().notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  homeLat: doublePrecision("home_lat").notNull(),
  homeLng: doublePrecision("home_lng").notNull(),
  homeTz: text("home_tz").notNull().default("America/Denver"),
  botDatingOptIn: boolean("bot_dating_opt_in").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const datingBots = pgTable("dating_bots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  vibeTags: text("vibe_tags").array().notNull(),
  active: boolean("active").notNull().default(true),
  paused: boolean("paused").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const preferences = pgTable("preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  cuisine: text("cuisine").array().notNull(),
  budget: integer("budget").notNull(),
  maxTravelKm: integer("max_travel_km").notNull(),
  dealbreakers: text("dealbreakers").array().notNull(),
  lookingFor: text("looking_for").notNull().default("unsure"),
  interests: text("interests").array().notNull(),
});

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userAId: uuid("user_a_id")
    .notNull()
    .references(() => users.id),
  userBId: uuid("user_b_id")
    .notNull()
    .references(() => users.id),
  state: text("state").notNull(),
  /** Internal only — never serialize to client DTOs. */
  confidence: doublePrecision("confidence").notNull().default(0),
  band: text("band").notNull(),
  reasons: text("reasons").array().notNull(),
  safetyOk: boolean("safety_ok").notNull().default(true),
  profileFit: doublePrecision("profile_fit").notNull().default(0),
  chemistry: doublePrecision("chemistry").notNull().default(0),
  logistics: doublePrecision("logistics").notNull().default(0),
  chemistryDims: jsonb("chemistry_dims")
    .$type<{
      reciprocity: number;
      curiosity: number;
      valueAlignment: number;
      emotionalSafety: number;
      sharedSpark: number;
    }>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id),
  role: text("role").notNull(),
  text: text("text").notNull(),
  safetyOk: boolean("safety_ok").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull(),
  priceTier: integer("price_tier").notNull(),
  approxNeighborhood: text("approx_neighborhood").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  source: text("source").notNull().default("stub"),
});

export const venueCatalog = pgTable("venue_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull(),
  priceTier: integer("price_tier").notNull(),
  approxNeighborhood: text("approx_neighborhood").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  source: text("source").notNull().default("catalog"),
});

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  windowLabel: text("window_label").notNull(),
  timeZone: text("time_zone").notNull().default("America/Denver"),
  status: text("status").notNull().default("pending"),
  userAStatus: text("user_a_status").notNull().default("waiting"),
  userBStatus: text("user_b_status").notNull().default("waiting"),
  travelKmA: doublePrecision("travel_km_a").notNull(),
  travelKmB: doublePrecision("travel_km_b").notNull(),
  why: text("why").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Web Push subscription or Expo token. Status-only payloads (frozen A). */
export const pushDevices = pgTable("push_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  endpoint: text("endpoint"),
  p256dh: text("p256dh"),
  auth: text("auth"),
  expoToken: text("expo_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
