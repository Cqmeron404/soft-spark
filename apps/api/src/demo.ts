import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEMO_ACCOUNTS, DEMO_ONBOARD, EVENTS, dualStatusSummary, formatMilesFromKm } from "@soft-spark/shared";
import { PGlite } from "@soft-spark/db";
import { runInviteThresholdRegression } from "@soft-spark/match-engine";
import { createApp } from "./app.js";
import { bootstrap } from "./bootstrap.js";
import { webOrigins } from "./cors.js";
import { allowDemoUsers, bootMissing, placesMissing } from "./env.js";
import { ensureDemoUsers } from "./ensure-demo-users.js";
import { runNexusSoakScenarios } from "./nexus-soak.js";
import { createEngine, orchestrateMatch } from "./orchestrate.js";

const MAYA = DEMO_ONBOARD.maya;
const JORDAN = DEMO_ONBOARD.jordan;

type OnboardRes = { user: { id: string; displayName: string }; bot: { id: string } };
type MatchRes = {
  id: string;
  state: string;
  band: string;
  invite?: {
    id: string;
    you?: string;
    them?: string;
    venue?: { travelKmYou: number; travelKmThem: number };
  };
};

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function cookiesFrom(res: Response): string {
  const parts =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

async function signUp(
  app: ReturnType<typeof createApp>,
  input: { email: string; password: string; name: string }
) {
  const res = await app.request("/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return { res, cookie: cookiesFrom(res) };
}

async function main() {
  process.env.MATCH_ENGINE_MODE ??= "stub";
  const failures: string[] = [];
  const soak = await runInviteThresholdRegression();
  for (const f of soak) failures.push(f);
  if (!soak.length) console.log("ok  invite_threshold 0.75 soak / persona regression");

  if (bootMissing({ NODE_ENV: "production" } as NodeJS.ProcessEnv).join() !== "DATABASE_URL,BETTER_AUTH_SECRET") {
    failures.push("prod boot should require DATABASE_URL + BETTER_AUTH_SECRET");
  } else console.log("ok  prod boot validates DATABASE_URL + BETTER_AUTH_SECRET");
  if (placesMissing({ NODE_ENV: "production" } as NodeJS.ProcessEnv)[0] !== "GOOGLE_PLACES_API_KEY") {
    failures.push("prod places should require GOOGLE_PLACES_API_KEY when seed mode is off");
  } else console.log("ok  prod VenueSuggester requires GOOGLE_PLACES_API_KEY unless seed");
  const seedEnv = { NODE_ENV: "production", ALLOW_VENUE_SEED: "1" } as NodeJS.ProcessEnv;
  const venueModeEnv = { NODE_ENV: "production", VENUE_MODE: "seed" } as NodeJS.ProcessEnv;
  if (placesMissing(seedEnv).length || placesMissing(venueModeEnv).length) {
    failures.push("prod seed mode (ALLOW_VENUE_SEED=1 or VENUE_MODE=seed) should not require Places");
  } else console.log("ok  prod seed flags skip GOOGLE_PLACES_API_KEY");
  if (bootMissing({ NODE_ENV: "production", ALLOW_VENUE_SEED: "1" } as NodeJS.ProcessEnv).includes("GOOGLE_PLACES_API_KEY")) {
    failures.push("prod boot must not fail solely for missing Places when seed mode is on");
  } else console.log("ok  prod boot does not require Places in seed mode");

  if (allowDemoUsers({ NODE_ENV: "production" } as NodeJS.ProcessEnv) !== true) {
    failures.push("prod should ensure Maya/Jordan demo users by default");
  } else console.log("ok  prod ensures demo users unless ALLOW_DEMO_USERS=0");
  if (allowDemoUsers({ NODE_ENV: "production", ALLOW_DEMO_USERS: "0" } as NodeJS.ProcessEnv)) {
    failures.push("ALLOW_DEMO_USERS=0 should disable demo ensure in prod");
  } else console.log("ok  ALLOW_DEMO_USERS=0 disables demo ensure");
  if (allowDemoUsers({} as NodeJS.ProcessEnv)) {
    failures.push("local default should not auto-ensure (soak still signs up Maya/Jordan)");
  } else console.log("ok  local soak does not auto-ensure demo users");
  if (!allowDemoUsers({ ALLOW_DEMO_USERS: "1" } as NodeJS.ProcessEnv)) {
    failures.push("ALLOW_DEMO_USERS=1 should enable local demo ensure");
  } else console.log("ok  ALLOW_DEMO_USERS=1 enables local demo ensure");

  const ctx = await bootstrap({ pglite: new PGlite(), seedDemoUsers: false });
  const app = createApp(ctx);

  process.env.WEB_ORIGIN ??= "http://localhost:3000";
  const webOrigin = webOrigins()[0];
  const preflight = await app.request("/auth/sign-up/email", {
    method: "OPTIONS",
    headers: {
      Origin: webOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const preflightOrigin = preflight.headers.get("access-control-allow-origin");
  const preflightCreds = preflight.headers.get("access-control-allow-credentials");
  const preflightMethods = preflight.headers.get("access-control-allow-methods") ?? "";
  if (preflight.status !== 204 || preflightOrigin !== webOrigin || preflightCreds !== "true" || !preflightMethods.includes("POST")) {
    failures.push(
      `auth OPTIONS CORS expected 204 + WEB_ORIGIN + credentials, got ${preflight.status} origin=${preflightOrigin} creds=${preflightCreds} methods=${preflightMethods}`
    );
  } else console.log("ok  OPTIONS /auth/sign-up/email CORS for WEB_ORIGIN");

  const blocked = await app.request("/auth/sign-up/email", {
    method: "OPTIONS",
    headers: {
      Origin: "https://evil.example",
      "Access-Control-Request-Method": "POST",
    },
  });
  if (blocked.headers.get("access-control-allow-origin") === "https://evil.example") {
    failures.push("auth OPTIONS must not echo an untrusted Origin");
  } else console.log("ok  OPTIONS /auth/* does not reflect untrusted Origin");

  const unauth = await app.request("/matches");
  if (unauth.status !== 401) failures.push(`protected /matches expected 401, got ${unauth.status}`);
  else console.log("ok  unauthenticated GET /matches → 401");

  const noOpt = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...MAYA, botDatingOptIn: false }),
  });
  if (noOpt.status !== 401) failures.push(`onboard without session expected 401, got ${noOpt.status}`);
  else console.log("ok  onboard without session → 401");

  const mayaAuth = await signUp(app, {
    email: DEMO_ACCOUNTS.maya.email,
    password: DEMO_ACCOUNTS.maya.password,
    name: DEMO_ACCOUNTS.maya.name,
  });
  if (mayaAuth.res.status >= 400) {
    failures.push(`maya sign-up failed ${mayaAuth.res.status} ${await mayaAuth.res.text()}`);
  }
  const jordanAuth = await signUp(app, {
    email: DEMO_ACCOUNTS.jordan.email,
    password: DEMO_ACCOUNTS.jordan.password,
    name: DEMO_ACCOUNTS.jordan.name,
  });
  if (jordanAuth.res.status >= 400) {
    failures.push(`jordan sign-up failed ${jordanAuth.res.status} ${await jordanAuth.res.text()}`);
  }
  console.log("ok  Better Auth sign-up Maya + Jordan");

  const mayaMe = await app.request("/users/me", { headers: { cookie: mayaAuth.cookie } });
  if (mayaMe.status !== 404) failures.push(`signed-in without profile expected 404, got ${mayaMe.status}`);
  else console.log("ok  signed-in without profile → 404 profile_incomplete");

  const noOptAuthed = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: mayaAuth.cookie },
    body: JSON.stringify({ ...MAYA, botDatingOptIn: false }),
  });
  if (noOptAuthed.status !== 400) failures.push(`opt-in expected 400, got ${noOptAuthed.status}`);
  else console.log("ok  onboard without botDatingOptIn → 400");

  const mayaRes = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: mayaAuth.cookie },
    body: JSON.stringify(MAYA),
  });
  const jordanRes = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: jordanAuth.cookie },
    body: JSON.stringify(JORDAN),
  });
  if (mayaRes.status !== 201 || jordanRes.status !== 201) {
    failures.push(`onboard should create User + DatingBot (${mayaRes.status}/${jordanRes.status})`);
  }
  const maya = await json<OnboardRes>(mayaRes);
  const jordan = await json<OnboardRes>(jordanRes);
  if (!maya.user?.id || !maya.bot?.id) failures.push("maya missing user/bot");
  const mayaProfile = await json<{ photoUrl?: string }>(
    await app.request("/users/me", { headers: { cookie: mayaAuth.cookie } })
  );
  if (mayaProfile.photoUrl !== MAYA.photoUrl) failures.push("onboard did not persist photoUrl");
  else console.log("ok  onboard Maya + Jordan (User + DatingBot + photoUrl)");

  {
    const seeded = await bootstrap({ pglite: new PGlite(), seedDemoUsers: true });
    const seededApp = createApp(seeded);
    const mayaIn = await seededApp.request("/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: DEMO_ACCOUNTS.maya.email, password: DEMO_ACCOUNTS.maya.password }),
    });
    if (mayaIn.status >= 400) {
      failures.push(`seeded Maya sign-in failed ${mayaIn.status} ${await mayaIn.text()}`);
    }
    const mayaCookie = cookiesFrom(mayaIn);
    const seededMaya = await json<{ displayName?: string; photoUrl?: string }>(
      await seededApp.request("/users/me", { headers: { cookie: mayaCookie } })
    );
    if (seededMaya.displayName !== "Maya" || seededMaya.photoUrl !== MAYA.photoUrl) {
      failures.push("seeded Maya sign-in should land onboarded with photoUrl");
    } else console.log("ok  ensure-demo-users: Maya sign-in (no prior sign-up)");

    const jordanIn = await seededApp.request("/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: DEMO_ACCOUNTS.jordan.email,
        password: DEMO_ACCOUNTS.jordan.password,
      }),
    });
    if (jordanIn.status >= 400) {
      failures.push(`seeded Jordan sign-in failed ${jordanIn.status} ${await jordanIn.text()}`);
    }
    const seededJordan = await json<{ displayName?: string }>(
      await seededApp.request("/users/me", { headers: { cookie: cookiesFrom(jordanIn) } })
    );
    if (seededJordan.displayName !== "Jordan") {
      failures.push("seeded Jordan sign-in should land onboarded");
    } else console.log("ok  ensure-demo-users: Jordan sign-in (no prior sign-up)");

    const again = await ensureDemoUsers(seeded);
    if (again.users.length !== 2 || again.users.some((u) => u.createdAuth)) {
      failures.push("second ensure-demo-users should be idempotent");
    } else console.log("ok  ensure-demo-users is idempotent");

    const seededMatches = await json<{ id: string; state: string }[]>(
      await seededApp.request("/matches", { headers: { cookie: mayaCookie } })
    );
    if (!seededMatches[0]) {
      failures.push("seeded Maya should land on a demo match, not an empty list");
    } else console.log(`ok  ensure-demo-users match state=${seededMatches[0].state}`);

    const gated = await seededApp.request("/internal/ensure-demo-users", { method: "POST" });
    if (gated.status !== 404) {
      failures.push(`ensure endpoint without ALLOW_DEMO_USERS expected 404, got ${gated.status}`);
    } else console.log("ok  POST /internal/ensure-demo-users → 404 unless allowed");
    await seeded.close();
  }

  {
    const drift = await bootstrap({ pglite: new PGlite(), seedDemoUsers: false });
    const driftApp = createApp(drift);
    const wrong = await signUp(driftApp, {
      email: DEMO_ACCOUNTS.maya.email,
      password: "not-the-ui-password",
      name: DEMO_ACCOUNTS.maya.name,
    });
    if (wrong.res.status >= 400) {
      failures.push(`drift Maya sign-up failed ${wrong.res.status} ${await wrong.res.text()}`);
    }
    await ensureDemoUsers(drift);
    const fixed = await driftApp.request("/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: DEMO_ACCOUNTS.maya.email, password: DEMO_ACCOUNTS.maya.password }),
    });
    if (fixed.status >= 400) {
      failures.push(`demo password realign failed ${fixed.status} ${await fixed.text()}`);
    } else console.log("ok  ensure-demo-users realigns Maya password to the UI button");
    await drift.close();
  }

  ctx.events.clear();
  const engine = await createEngine(ctx.store);
  const match = await orchestrateMatch({
    store: ctx.store,
    events: ctx.events,
    hub: ctx.hub,
    engine,
    userAId: maya.user.id,
    userBId: jordan.user.id,
  });
  if (match.state !== "invited") {
    failures.push(`expected invited, got ${match.state} band=${match.band} conf=${match.confidence}`);
  } else {
    console.log(`ok  orchestrate → ${match.state} band=${match.band} reasons=${match.reasons.join(",")}`);
  }

  const required = [
    EVENTS.BOT_TURN_REQUESTED,
    EVENTS.BOT_TURN_COMPLETED,
    EVENTS.MATCH_SCORE_UPDATED,
    EVENTS.MATCH_INVITE_READY,
    EVENTS.INVITE_SENT,
  ];
  for (const name of required) {
    if (!ctx.events.types().includes(name)) failures.push(`missing event ${name}`);
  }
  console.log("ok  events", ctx.events.types().filter((t, i, a) => a.indexOf(t) === i).join(" · "));

  const list = await app.request("/matches", { headers: { cookie: mayaAuth.cookie } });
  const matches = await json<MatchRes[]>(list);
  const raw = JSON.stringify(matches);
  if (raw.includes('"confidence"') || raw.includes("transcript") || /"messages"\s*:/.test(raw)) {
    failures.push("GET /matches leaked confidence, transcript, or messages[]");
  }
  if (!matches[0] || matches[0].state !== "invited" || !matches[0].band) {
    failures.push("GET /matches should return state + band");
  } else {
    console.log("ok  GET /matches → state + band only");
  }
  const jordanListRaw = JSON.stringify(
    await json(await app.request("/matches", { headers: { cookie: jordanAuth.cookie } }))
  );
  if (!jordanListRaw.includes("maya.jpg")) failures.push("match peer missing photoUrl");
  else console.log("ok  match/invite peer uses photoUrl");

  const detail = await json<MatchRes>(
    await app.request(`/matches/${match.id}`, { headers: { cookie: mayaAuth.cookie } })
  );
  const inviteId = detail.invite?.id as string;
  if (!inviteId) failures.push("missing invite on match detail");
  const kmYou = detail.invite?.venue?.travelKmYou;
  if (typeof kmYou === "number") {
    console.log(`ok  InviteCard miles copy: ${formatMilesFromKm(kmYou)} mi from you`);
  }

  const seenRealtime: string[] = [];
  const unsub = ctx.hub.subscribe(jordan.user.id, (evt) => {
    seenRealtime.push(evt.type);
    if (evt.invite && "confidence" in (evt as object)) {
      failures.push("realtime event leaked confidence");
    }
  });

  const a1 = await app.request(`/matches/${match.id}/invites/${inviteId}/accept`, {
    method: "POST",
    headers: { cookie: mayaAuth.cookie },
  });
  const afterMaya = await json<MatchRes>(a1);
  if (afterMaya.invite?.you !== "accepted" || afterMaya.state !== "invited") {
    failures.push("after Maya accept expected waiting on Jordan");
  } else console.log("ok  Maya accept → waiting on Jordan");

  if (!seenRealtime.includes("invite.accepted")) {
    failures.push("peer did not receive invite.accepted realtime event");
  } else console.log("ok  realtime invite.accepted pushed to peer (no full refresh)");

  unsub();

  const a2 = await app.request(`/matches/${match.id}/invites/${inviteId}/accept`, {
    method: "POST",
    headers: { cookie: jordanAuth.cookie },
  });
  const booked = await json<MatchRes>(a2);
  if (booked.state !== "booked") failures.push(`expected booked, got ${booked.state}`);
  else console.log("ok  dual accept → booked");

  const a3 = await app.request(`/matches/${match.id}/invites/${inviteId}/accept`, {
    method: "POST",
    headers: { cookie: mayaAuth.cookie },
  });
  const again = await json<MatchRes>(a3);
  if (again.state !== "booked" || a3.status !== 200) failures.push("accept should be idempotent");
  else console.log("ok  accept is idempotent");

  if (!ctx.events.types().includes(EVENTS.INVITE_ACCEPTED) || !ctx.events.types().includes(EVENTS.INVITE_BOOKED)) {
    failures.push("missing invite.accepted / invite.booked");
  }

  const pause = await app.request("/users/me/bot", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: mayaAuth.cookie },
    body: JSON.stringify({ paused: true }),
  });
  const pausedBot = await json<{ paused: boolean; id: string }>(pause);
  if (!pausedBot.paused) failures.push("PATCH bot paused should stick");
  else console.log("ok  Maya bot paused");

  ctx.events.clear();
  const kiraAuth = await signUp(app, {
    email: "kira@softspark.dev",
    password: "spark-demo-kira",
    name: "Kira",
  });
  const leoAuth = await signUp(app, {
    email: "leo@softspark.dev",
    password: "spark-demo-leo",
    name: "Leo",
  });
  const kiraRes = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: kiraAuth.cookie },
    body: JSON.stringify({ ...MAYA, profile: { ...MAYA.profile, displayName: "Kira" } }),
  });
  const leoRes = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: leoAuth.cookie },
    body: JSON.stringify({ ...JORDAN, profile: { ...JORDAN.profile, displayName: "Leo" } }),
  });
  const kira = await json<OnboardRes>(kiraRes);
  const leo = await json<OnboardRes>(leoRes);

  await app.request("/users/me/bot", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: kiraAuth.cookie },
    body: JSON.stringify({ paused: true }),
  });
  ctx.events.clear();
  const pausedMatch = await orchestrateMatch({
    store: ctx.store,
    events: ctx.events,
    engine: await createEngine(ctx.store),
    userAId: kira.user.id,
    userBId: leo.user.id,
  });
  const requested = ctx.events.events.filter((e) => e.type === EVENTS.BOT_TURN_REQUESTED);
  const kiraTurns = requested.filter((e) => e.payload.botId === kira.bot.id);
  if (kiraTurns.length > 0) failures.push("paused bot still received bot.turn.requested");
  else console.log(`ok  paused bot skipped (${requested.length} turns for Leo only, match ${pausedMatch.state})`);

  ctx.events.clear();
  const emptyEngine = await createEngine(ctx.store, { emptyVenues: true });
  const novaAuth = await signUp(app, {
    email: "nova@softspark.dev",
    password: "spark-demo-nova",
    name: "Nova",
  });
  const rioAuth = await signUp(app, {
    email: "rio@softspark.dev",
    password: "spark-demo-rio",
    name: "Rio",
  });
  const novaRes = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: novaAuth.cookie },
    body: JSON.stringify({ ...MAYA, profile: { ...MAYA.profile, displayName: "Nova" } }),
  });
  const rioRes = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: rioAuth.cookie },
    body: JSON.stringify({ ...JORDAN, profile: { ...JORDAN.profile, displayName: "Rio" } }),
  });
  const nova = await json<OnboardRes>(novaRes);
  const rio = await json<OnboardRes>(rioRes);
  const exploring = await orchestrateMatch({
    store: ctx.store,
    events: ctx.events,
    engine: emptyEngine,
    userAId: nova.user.id,
    userBId: rio.user.id,
  });
  if (exploring.state !== "exploring") {
    failures.push(`venue_unavailable should stay exploring, got ${exploring.state}`);
  } else if (!ctx.events.types().includes(EVENTS.MATCH_VENUE_UNAVAILABLE)) {
    failures.push("missing match.venue_unavailable");
  } else {
    console.log("ok  0 venues → exploring + match.venue_unavailable");
  }

  const copyBoth = dualStatusSummary({ themName: "Jordan", you: "waiting", them: "waiting" });
  const copyExpired = dualStatusSummary({ themName: "Jordan", you: "waiting", them: "waiting", expired: true });
  if (copyBoth !== "Waiting on both of you…") failures.push(`DualStatusRow copy drifted: ${copyBoth}`);
  if (copyExpired !== "This invite expired. Your bot keeps exploring") failures.push("expired DualStatusRow copy drifted");
  else console.log("ok  DualStatusRow Aura copy");

  const photoPatch = await app.request("/users/me", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: mayaAuth.cookie },
    body: JSON.stringify({ photoUrl: "https://cdn.softspark.dev/maya.jpg" }),
  });
  const photoUser = await json<{ photoUrl?: string }>(photoPatch);
  if (photoUser.photoUrl !== "https://cdn.softspark.dev/maya.jpg") failures.push("photoUrl not persisted on profile patch");
  else console.log("ok  onboard/profile photoUrl persisted");

  const pushReg = await app.request("/users/me/push", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: jordanAuth.cookie },
    body: JSON.stringify({ platform: "expo", expoToken: "ExponentPushToken[demo]" }),
  });
  if (pushReg.status !== 201) failures.push(`push register expected 201, got ${pushReg.status}`);
  else console.log("ok  Expo push token registered (status-only sender)");

  const health = await json<{
    venues?: string;
    matchEngine?: string;
    env?: { database?: boolean; places?: boolean; demoUsers?: boolean };
  }>(await app.request("/health"));
  if (!health.env) failures.push("health missing env flags");
  if (typeof health.env?.demoUsers !== "boolean") failures.push("health missing env.demoUsers flag");
  if (health.venues !== "seed" && health.venues !== "places") {
    failures.push(`health venues mode should be seed|places, got ${health.venues}`);
  }
  if ((health.matchEngine ?? "stub") !== "stub" && process.env.MATCH_ENGINE_MODE === "stub") {
    failures.push("default MATCH_ENGINE_MODE should be stub");
  }
  if (health.venues === "seed" || health.venues === "places") {
    console.log(`ok  /health reports venues=${health.venues} matchEngine=${health.matchEngine ?? "stub"} (no secrets)`);
  }

  await runNexusSoakScenarios({
    app,
    store: ctx.store,
    events: ctx.events,
    failures,
  });

  await ctx.close();

  const dataDir = await mkdtemp(join(tmpdir(), "soft-spark-"));
  try {
    const first = await bootstrap({ dataDir, seedDemoUsers: false });
    const app1 = createApp(first);
    const persistAuth = await signUp(app1, {
      email: "persist@softspark.dev",
      password: "spark-demo-persist",
      name: "Persist",
    });
    const persistOnboard = await app1.request("/users/me/onboard", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: persistAuth.cookie },
      body: JSON.stringify({ ...MAYA, profile: { ...MAYA.profile, displayName: "Persist" } }),
    });
    const persistUser = await json<OnboardRes>(persistOnboard);
    await first.close();

    const second = await bootstrap({ dataDir, seedDemoUsers: false });
    const app2 = createApp(second);
    const signIn = await app2.request("/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "persist@softspark.dev", password: "spark-demo-persist" }),
    });
    const persistCookie = cookiesFrom(signIn);
    const survived = await json<{ displayName: string }>(
      await app2.request("/users/me", { headers: { cookie: persistCookie } })
    );
    if (survived.displayName !== "Persist" || persistUser.user.displayName !== "Persist") {
      failures.push("postgres/pglite restart did not keep user");
    } else console.log("ok  restart: user/profile survived PGlite reopen");
    await second.close();
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }

  if (failures.length) {
    console.error("\nDEMO FAILED");
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log("\nSlice 3 path: Deploy wiring → Places prod → Push (band/invite) → DualStatusRow/photo → LLM soak → booked");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
