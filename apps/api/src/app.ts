import { Hono } from "hono";
import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import type { LookingFor, OnboardBody, PriceTier } from "@soft-spark/shared";
import { eventLog } from "./event-log.js";
import {
  assertClientSafe,
  toBotDto,
  toMatchDetail,
  toMatchListItem,
  toUserDto,
} from "./map-client.js";
import { createEngine, orchestrateMatch, respondInvite } from "./orchestrate.js";
import { store } from "./store.js";

export type AppEnv = {
  Variables: { userId: string };
};

export function createApp() {
  const app = new Hono<AppEnv>();
  app.use(
    "/*",
    cors({
      origin: "*",
      allowHeaders: ["Content-Type", "Authorization", "x-user-id"],
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    })
  );

  app.get("/health", (c) => c.json({ ok: true, service: "soft-spark-api" }));

  app.post("/users/me/onboard", async (c) => {
    const body = (await c.req.json()) as OnboardBody;
    if (body.botDatingOptIn !== true) {
      return c.json({ error: "botDatingOptIn required" }, 400);
    }
    const profile = body.profile;
    const prefs = body.prefs;
    if (!profile?.displayName || !profile.age || !profile.gender) {
      return c.json({ error: "profile.displayName, age, gender required" }, 400);
    }
    if (!prefs?.cuisine?.length || !prefs.maxTravelKm || !prefs.budget) {
      return c.json({ error: "prefs cuisine, budget, maxTravelKm required" }, 400);
    }
    if (!body.homeGeo) return c.json({ error: "homeGeo required" }, 400);

    const user = store.createUser({
      displayName: profile.displayName,
      age: profile.age,
      gender: profile.gender,
      interestedIn: profile.interestedIn ?? [],
      bio: profile.bio,
      homeLat: body.homeGeo.lat,
      homeLng: body.homeGeo.lng,
      homeTz: body.homeTz ?? "America/Denver",
      botDatingOptIn: true,
    });
    store.createPrefs({
      userId: user.id,
      cuisine: prefs.cuisine,
      budget: prefs.budget as PriceTier,
      maxTravelKm: prefs.maxTravelKm,
      dealbreakers: prefs.dealbreakers ?? [],
      lookingFor: (prefs.lookingFor as LookingFor | undefined) ?? "unsure",
      interests: prefs.interests ?? [],
    });
    const bot = store.createBot({
      userId: user.id,
      vibeTags: body.vibeTags ?? [],
      active: true,
      paused: false,
    });
    const payload = { user: toUserDto(store, user.id), bot: toBotDto(store, user.id) };
    assertClientSafe(payload);
    return c.json(payload, 201);
  });

  app.use("/users/me/*", requireSession);
  app.use("/users/me", requireSession);
  app.use("/matches/*", requireSession);
  app.use("/matches", requireSession);

  app.get("/users/me", (c) => {
    const userId = c.get("userId");
    const payload = toUserDto(store, userId);
    assertClientSafe(payload);
    return c.json(payload);
  });

  app.patch("/users/me", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json();
    const user = store.users.get(userId);
    if (!user) return c.json({ error: "not_found" }, 404);
    const prefs = store.prefsForUser(userId);
    if (body.profile) {
      Object.assign(user, {
        displayName: body.profile.displayName ?? user.displayName,
        age: body.profile.age ?? user.age,
        gender: body.profile.gender ?? user.gender,
        interestedIn: body.profile.interestedIn ?? user.interestedIn,
        bio: body.profile.bio ?? user.bio,
        updatedAt: new Date().toISOString(),
      });
    }
    if (body.homeGeo) {
      user.homeLat = body.homeGeo.lat;
      user.homeLng = body.homeGeo.lng;
    }
    if (body.prefs) {
      Object.assign(prefs, {
        cuisine: body.prefs.cuisine ?? prefs.cuisine,
        budget: body.prefs.budget ?? prefs.budget,
        maxTravelKm: body.prefs.maxTravelKm ?? prefs.maxTravelKm,
        dealbreakers: body.prefs.dealbreakers ?? prefs.dealbreakers,
        lookingFor: body.prefs.lookingFor ?? prefs.lookingFor,
        interests: body.prefs.interests ?? prefs.interests,
      });
    }
    return c.json(toUserDto(store, userId));
  });

  app.get("/users/me/bot", (c) => {
    return c.json(toBotDto(store, c.get("userId")));
  });

  app.patch("/users/me/bot", async (c) => {
    const userId = c.get("userId");
    const bot = store.botForUser(userId);
    if (!bot) return c.json({ error: "not_found" }, 404);
    const body = await c.req.json();
    if (Array.isArray(body.vibeTags)) bot.vibeTags = body.vibeTags;
    if (typeof body.paused === "boolean") bot.paused = body.paused;
    if (typeof body.active === "boolean") bot.active = body.active;
    return c.json(toBotDto(store, userId));
  });

  app.get("/matches", (c) => {
    const userId = c.get("userId");
    const payload = store.matchesForUser(userId).map((m) => toMatchListItem(store, m.id, userId));
    assertClientSafe(payload);
    return c.json(payload);
  });

  app.get("/matches/:id", (c) => {
    const userId = c.get("userId");
    const match = store.matches.get(c.req.param("id"));
    if (!match) return c.json({ error: "not_found" }, 404);
    if (match.userAId !== userId && match.userBId !== userId) {
      return c.json({ error: "forbidden" }, 403);
    }
    const payload = toMatchDetail(store, match.id, userId);
    assertClientSafe(payload);
    return c.json(payload);
  });

  app.post("/matches/:id/invites/:inviteId/accept", (c) => {
    try {
      const { match } = respondInvite({
        store,
        events: eventLog,
        matchId: c.req.param("id"),
        inviteId: c.req.param("inviteId"),
        userId: c.get("userId"),
        action: "accept",
      });
      const payload = toMatchDetail(store, match.id, c.get("userId"));
      assertClientSafe(payload);
      return c.json(payload);
    } catch (err) {
      return handleErr(c, err);
    }
  });

  app.post("/matches/:id/invites/:inviteId/decline", (c) => {
    try {
      const { match } = respondInvite({
        store,
        events: eventLog,
        matchId: c.req.param("id"),
        inviteId: c.req.param("inviteId"),
        userId: c.get("userId"),
        action: "decline",
      });
      const payload = toMatchDetail(store, match.id, c.get("userId"));
      assertClientSafe(payload);
      return c.json(payload);
    } catch (err) {
      return handleErr(c, err);
    }
  });

  app.post("/internal/orchestrate", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const ids = [body.userAId, body.userBId].filter(Boolean);
    const users = ids.length === 2 ? ids : lastTwoUserIds();
    if (users.length < 2) return c.json({ error: "need two onboarded users" }, 400);
    try {
      const engine = createEngine(store, { emptyVenues: Boolean(body.emptyVenues) });
      const match = await orchestrateMatch({
        store,
        events: eventLog,
        engine,
        userAId: users[0],
        userBId: users[1],
      });
      return c.json({
        matchId: match.id,
        state: match.state,
        band: match.band,
        reasons: match.reasons,
      });
    } catch (err) {
      return handleErr(c, err);
    }
  });

  app.get("/internal/events", (c) => c.json(eventLog.events));

  return app;
}

function lastTwoUserIds(): string[] {
  return [...store.users.values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-2)
    .map((u) => u.id);
}

function sessionUserId(c: { req: { header: (n: string) => string | undefined } }): string | null {
  const header = c.req.header("x-user-id");
  if (header) return header;
  const auth = c.req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

async function requireSession(c: Context<AppEnv>, next: Next) {
  const userId = sessionUserId(c);
  if (!userId || !store.users.has(userId)) {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("userId", userId);
  await next();
}

function handleErr(c: { json: (body: unknown, status: 400 | 401 | 403 | 404 | 409 | 500) => Response }, err: unknown) {
  const raw =
    typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
  const allowed = new Set([400, 401, 403, 404, 409, 500]);
  const status = (allowed.has(raw) ? raw : 500) as 400 | 401 | 403 | 404 | 409 | 500;
  const message = err instanceof Error ? err.message : "error";
  return c.json({ error: message }, status);
}
