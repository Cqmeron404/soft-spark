import { Hono } from "hono";
import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type { SparkDb } from "@soft-spark/db";
import type { LookingFor, OnboardBody, PriceTier } from "@soft-spark/shared";
import type { Auth } from "./auth.js";
import { authMode, resolveSession } from "./auth.js";
import type { EventLog } from "./event-log.js";
import {
  assertClientSafe,
  toBotDto,
  toMatchDetail,
  toMatchListItem,
  toUserDto,
} from "./map-client.js";
import { createEngine, orchestrateMatch, respondInvite } from "./orchestrate.js";
import type { PushDispatcher } from "./push.js";
import type { RealtimeHub } from "./realtime.js";
import type { SparkStore } from "./store.js";
import { envFlags } from "./env.js";

export type AppEnv = {
  Variables: { userId: string; authId: string };
};

export type AppDeps = {
  store: SparkStore;
  auth: Auth;
  hub: RealtimeHub;
  events: EventLog;
  db: SparkDb;
  push?: PushDispatcher;
};

export function createApp(deps: AppDeps) {
  const { store, auth, hub, events, db, push } = deps;
  const app = new Hono<AppEnv>();
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  app.use(
    "/*",
    cors({
      origin: (origin) => origin || webOrigin,
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization", "x-user-id"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    })
  );

  app.get("/health", (c) => {
    const flags = envFlags();
    return c.json({
      ok: true,
      service: "soft-spark-api",
      authMode: authMode(),
      matchEngine: process.env.MATCH_ENGINE_MODE ?? "stub",
      env: {
        database: flags.database,
        authSecret: flags.authSecret,
        places: flags.places,
        llm: flags.llm,
        webPush: flags.webPush,
      },
    });
  });

  app.get("/push/vapid-public", (c) =>
    c.json({
      configured: Boolean(process.env.VAPID_PUBLIC_KEY),
      publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    })
  );

  app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));

  app.use("/users/me/*", (c, next) => requireSession(c, next, { store, auth, db }));
  app.use("/users/me", (c, next) => requireSession(c, next, { store, auth, db }));
  app.use("/matches/*", (c, next) => requireSession(c, next, { store, auth, db }));
  app.use("/matches", (c, next) => requireSession(c, next, { store, auth, db }));
  app.use("/realtime/*", (c, next) => requireSession(c, next, { store, auth, db }));

  app.post("/users/me/onboard", async (c) => {
    const authId = c.get("authId");
    if (!authId) return c.json({ error: "unauthorized" }, 401);
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

    const session = await resolveSession(auth, db, c.req.raw.headers);
    const email = session?.user.email ?? `${authId}@users.softspark`;
    const existing = await store.userByAuthId(authId);
    const user = existing
      ? await store.updateUser(existing.id, {
          displayName: profile.displayName,
          age: profile.age,
          gender: profile.gender,
          interestedIn: profile.interestedIn ?? [],
          bio: profile.bio,
          photoUrl: body.photoUrl,
          homeLat: body.homeGeo.lat,
          homeLng: body.homeGeo.lng,
          homeTz: body.homeTz ?? "America/Denver",
        })
      : await store.createUser({
          authId,
          email,
          displayName: profile.displayName,
          age: profile.age,
          gender: profile.gender,
          interestedIn: profile.interestedIn ?? [],
          bio: profile.bio,
          photoUrl: body.photoUrl,
          homeLat: body.homeGeo.lat,
          homeLng: body.homeGeo.lng,
          homeTz: body.homeTz ?? "America/Denver",
          botDatingOptIn: true,
        });

    if (!(await store.botForUser(user.id))) {
      await store.createBot({
        userId: user.id,
        vibeTags: body.vibeTags ?? [],
        active: true,
        paused: false,
      });
    } else if (body.vibeTags) {
      await store.updateBot(user.id, { vibeTags: body.vibeTags });
    }

    try {
      await store.prefsForUser(user.id);
      await store.updatePrefs(user.id, {
        cuisine: prefs.cuisine,
        budget: prefs.budget as PriceTier,
        maxTravelKm: prefs.maxTravelKm,
        dealbreakers: prefs.dealbreakers ?? [],
        lookingFor: (prefs.lookingFor as LookingFor | undefined) ?? "unsure",
        interests: prefs.interests ?? [],
      });
    } catch {
      await store.createPrefs({
        userId: user.id,
        cuisine: prefs.cuisine,
        budget: prefs.budget as PriceTier,
        maxTravelKm: prefs.maxTravelKm,
        dealbreakers: prefs.dealbreakers ?? [],
        lookingFor: (prefs.lookingFor as LookingFor | undefined) ?? "unsure",
        interests: prefs.interests ?? [],
      });
    }

    const payload = { user: await toUserDto(store, user.id), bot: await toBotDto(store, user.id) };
    assertClientSafe(payload);
    return c.json(payload, existing ? 200 : 201);
  });

  app.get("/users/me", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "profile_incomplete" }, 404);
    const payload = await toUserDto(store, userId);
    assertClientSafe(payload);
    return c.json(payload);
  });

  app.patch("/users/me", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "profile_incomplete" }, 404);
    const body = await c.req.json();
    const user = await store.getUser(userId);
    if (!user) return c.json({ error: "not_found" }, 404);
    if (body.profile || body.homeGeo || body.photoUrl) {
      await store.updateUser(userId, {
        displayName: body.profile?.displayName,
        age: body.profile?.age,
        gender: body.profile?.gender,
        interestedIn: body.profile?.interestedIn,
        bio: body.profile?.bio,
        photoUrl: body.photoUrl ?? body.profile?.photoUrl,
        homeLat: body.homeGeo?.lat,
        homeLng: body.homeGeo?.lng,
      });
    }
    if (body.prefs) {
      await store.updatePrefs(userId, {
        cuisine: body.prefs.cuisine,
        budget: body.prefs.budget,
        maxTravelKm: body.prefs.maxTravelKm,
        dealbreakers: body.prefs.dealbreakers,
        lookingFor: body.prefs.lookingFor,
        interests: body.prefs.interests,
      });
    }
    return c.json(await toUserDto(store, userId));
  });

  app.get("/users/me/bot", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "profile_incomplete" }, 404);
    return c.json(await toBotDto(store, userId));
  });

  app.patch("/users/me/bot", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "profile_incomplete" }, 404);
    const bot = await store.botForUser(userId);
    if (!bot) return c.json({ error: "not_found" }, 404);
    const body = await c.req.json();
    const payload = await store.updateBot(userId, {
      vibeTags: Array.isArray(body.vibeTags) ? body.vibeTags : undefined,
      paused: typeof body.paused === "boolean" ? body.paused : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
    });
    return c.json({
      id: payload.id,
      vibeTags: payload.vibeTags,
      active: payload.active,
      paused: payload.paused,
    });
  });

  app.post("/users/me/push", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "profile_incomplete" }, 404);
    const body = (await c.req.json()) as {
      platform?: "web" | "expo";
      subscription?: { endpoint: string; keys?: { p256dh?: string; auth?: string } };
      expoToken?: string;
    };
    const platform = body.platform ?? (body.expoToken ? "expo" : "web");
    if (platform === "expo" && !body.expoToken) {
      return c.json({ error: "expoToken required" }, 400);
    }
    if (platform === "web" && !body.subscription?.endpoint) {
      return c.json({ error: "subscription.endpoint required" }, 400);
    }
    const device = await store.upsertPushDevice({
      userId,
      platform,
      endpoint: body.subscription?.endpoint,
      p256dh: body.subscription?.keys?.p256dh,
      auth: body.subscription?.keys?.auth,
      expoToken: body.expoToken,
    });
    return c.json({ id: device.id, platform: device.platform, configured: push?.configured() ?? { web: false, expo: true } }, 201);
  });

  app.get("/users/me/push", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "profile_incomplete" }, 404);
    const devices = await store.listPushDevices(userId);
    return c.json(
      devices.map((d) => ({ id: d.id, platform: d.platform }))
    );
  });

  app.get("/matches", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "profile_incomplete" }, 404);
    const payload = await Promise.all(
      (await store.matchesForUser(userId)).map((m) => toMatchListItem(store, m.id, userId))
    );
    assertClientSafe(payload);
    return c.json(payload);
  });

  app.get("/matches/:id", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "profile_incomplete" }, 404);
    const match = await store.getMatch(c.req.param("id"));
    if (!match) return c.json({ error: "not_found" }, 404);
    if (match.userAId !== userId && match.userBId !== userId) {
      return c.json({ error: "forbidden" }, 403);
    }
    const payload = await toMatchDetail(store, match.id, userId);
    assertClientSafe(payload);
    return c.json(payload);
  });

  app.post("/matches/:id/invites/:inviteId/accept", async (c) => {
    try {
      const { match } = await respondInvite({
        store,
        events,
        hub,
        push,
        matchId: c.req.param("id"),
        inviteId: c.req.param("inviteId"),
        userId: c.get("userId"),
        action: "accept",
      });
      const payload = await toMatchDetail(store, match.id, c.get("userId"));
      assertClientSafe(payload);
      return c.json(payload);
    } catch (err) {
      return handleErr(c, err);
    }
  });

  app.post("/matches/:id/invites/:inviteId/decline", async (c) => {
    try {
      const { match } = await respondInvite({
        store,
        events,
        hub,
        push,
        matchId: c.req.param("id"),
        inviteId: c.req.param("inviteId"),
        userId: c.get("userId"),
        action: "decline",
      });
      const payload = await toMatchDetail(store, match.id, c.get("userId"));
      assertClientSafe(payload);
      return c.json(payload);
    } catch (err) {
      return handleErr(c, err);
    }
  });

  app.get("/realtime/stream", (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    return streamSSE(c, async (stream) => {
      let alive = true;
      const unsub = hub.subscribe(userId, (event) => {
        if (!alive) return;
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      });
      stream.onAbort(() => {
        alive = false;
        unsub();
      });
      while (alive) {
        await stream.writeSSE({ event: "ping", data: "{}" });
        await stream.sleep(15000);
      }
    });
  });

  app.post("/internal/orchestrate", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const ids = [body.userAId, body.userBId].filter(Boolean);
    const users = ids.length === 2 ? ids : await store.lastUserIds(2);
    if (users.length < 2) return c.json({ error: "need two onboarded users" }, 400);
    try {
      const engine = await createEngine(store, { emptyVenues: Boolean(body.emptyVenues) });
      const match = await orchestrateMatch({
        store,
        events,
        hub,
        push,
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

  app.get("/internal/events", (c) => c.json(events.events));

  return app;
}

async function requireSession(
  c: Context<AppEnv>,
  next: Next,
  deps: { store: SparkStore; auth: Auth; db: SparkDb }
) {
  const headers = new Headers(c.req.raw.headers);
  const access = c.req.query("access_token");
  if (access && !headers.get("authorization")) {
    headers.set("authorization", `Bearer ${access}`);
  }
  const session = await resolveSession(deps.auth, deps.db, headers);
  if (session?.user?.id) {
    c.set("authId", session.user.id);
    const profile = await deps.store.userByAuthId(session.user.id);
    if (profile) c.set("userId", profile.id);
    return next();
  }

  if (authMode() === "prod") {
    return c.json({ error: "unauthorized" }, 401);
  }

  const header = c.req.header("x-user-id");
  if (header) {
    const user = await deps.store.getUser(header);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    c.set("userId", user.id);
    c.set("authId", user.authId);
    return next();
  }

  return c.json({ error: "unauthorized" }, 401);
}

function handleErr(c: { json: (body: unknown, status: 400 | 401 | 403 | 404 | 409 | 500) => Response }, err: unknown) {
  const raw =
    typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
  const allowed = new Set([400, 401, 403, 404, 409, 500]);
  const status = (allowed.has(raw) ? raw : 500) as 400 | 401 | 403 | 404 | 409 | 500;
  const message = err instanceof Error ? err.message : "error";
  return c.json({ error: message }, status);
}
