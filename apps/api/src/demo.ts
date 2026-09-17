import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEMO_ACCOUNTS,
  DEMO_JORDAN_ONBOARD,
  DEMO_MAYA_ONBOARD,
  EVENTS,
  dualStatusSummary,
  formatMilesFromKm,
} from "@soft-spark/shared";
import { PGlite } from "@soft-spark/db";
import { runInviteThresholdRegression } from "@soft-spark/match-engine";
import { createApp } from "./app.js";
import { bootstrap } from "./bootstrap.js";
import { isSoftSparkVercelWebOrigin, webOrigins } from "./cors.js";
import { ensureDemoUsers } from "./demo-users.js";
import { allowDemoUsers, bootMissing, INTERNAL_JOB_HEADER, placesMissing } from "./env.js";
import { runNexusSoakScenarios } from "./nexus-soak.js";
import { createEngine, orchestrateMatch } from "./orchestrate.js";

const MAYA = DEMO_MAYA_ONBOARD;
const JORDAN = DEMO_JORDAN_ONBOARD;

type OnboardRes = { user: { id: string; displayName: string }; bot: { id: string } };
type MatchRes = {
  id: string;
  state: string;
  band: string;
  invite?: {
    id: string;
    you?: string;
    them?: string;
    youCarryCue?: string;
    themCarryCue?: string;
    venue?: { travelKmYou: number; travelKmThem: number };
  };
};

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function assertInternalRouteLock(
  app: ReturnType<typeof createApp>,
  failures: string[]
) {
  const prev = {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_MODE: process.env.AUTH_MODE,
    INTERNAL_JOB_SECRET: process.env.INTERNAL_JOB_SECRET,
  };
  const restore = () => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };

  try {
    delete process.env.NODE_ENV;
    delete process.env.AUTH_MODE;
    delete process.env.INTERNAL_JOB_SECRET;

    const openEvents = await app.request("/internal/events");
    if (openEvents.status !== 200) {
      failures.push(`dev GET /internal/events expected 200, got ${openEvents.status}`);
    } else console.log("ok  local GET /internal/events open when not prod");

    const openOrch = await app.request("/internal/orchestrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (openOrch.status !== 400) {
      failures.push(`dev POST /internal/orchestrate expected 400 (need two users), got ${openOrch.status}`);
    } else console.log("ok  local POST /internal/orchestrate open when not prod");

    process.env.NODE_ENV = "production";
    const prodEvents = await app.request("/internal/events");
    const prodEventsBody = await json<{ error?: string }>(prodEvents);
    if (prodEvents.status !== 404 || prodEventsBody.error !== "not_found") {
      failures.push(
        `prod GET /internal/events expected 404 not_found, got ${prodEvents.status} ${JSON.stringify(prodEventsBody)}`
      );
    } else console.log("ok  prod GET /internal/events → 404");

    const prodOrch = await app.request("/internal/orchestrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (prodOrch.status !== 401) {
      failures.push(`prod POST /internal/orchestrate without secret expected 401, got ${prodOrch.status}`);
    } else console.log("ok  prod POST /internal/orchestrate without secret → 401");

    process.env.INTERNAL_JOB_SECRET = "demo-internal-job-test-secret";
    const wrong = await app.request("/internal/orchestrate", {
      method: "POST",
      headers: { "content-type": "application/json", [INTERNAL_JOB_HEADER]: "wrong" },
      body: "{}",
    });
    if (wrong.status !== 401) {
      failures.push(`prod POST /internal/orchestrate wrong secret expected 401, got ${wrong.status}`);
    } else console.log("ok  prod POST /internal/orchestrate wrong secret → 401");

    const authed = await app.request("/internal/orchestrate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [INTERNAL_JOB_HEADER]: "demo-internal-job-test-secret",
      },
      body: "{}",
    });
    if (authed.status !== 400) {
      failures.push(
        `prod POST /internal/orchestrate with secret expected 400 (need two users), got ${authed.status}`
      );
    } else console.log("ok  prod POST /internal/orchestrate with secret reaches job");

    const stillHidden = await app.request("/internal/events", {
      headers: { [INTERNAL_JOB_HEADER]: "demo-internal-job-test-secret" },
    });
    if (stillHidden.status !== 404) {
      failures.push(`prod GET /internal/events with secret still expected 404, got ${stillHidden.status}`);
    } else console.log("ok  prod GET /internal/events stays 404 even with secret");

    delete process.env.NODE_ENV;
    process.env.AUTH_MODE = "prod";
    delete process.env.INTERNAL_JOB_SECRET;
    const authModeOrch = await app.request("/internal/orchestrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (authModeOrch.status !== 401) {
      failures.push(`AUTH_MODE=prod POST /internal/orchestrate expected 401, got ${authModeOrch.status}`);
    } else console.log("ok  AUTH_MODE=prod locks POST /internal/orchestrate");
  } finally {
    restore();
  }
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
  if (!allowDemoUsers({} as NodeJS.ProcessEnv) || !allowDemoUsers({ NODE_ENV: "production" } as NodeJS.ProcessEnv)) {
    failures.push("demo users should default ON so live one-tap works after redeploy");
  } else console.log("ok  demo users default ON (prod + unset)");
  if (allowDemoUsers({ ALLOW_DEMO_USERS: "0" } as NodeJS.ProcessEnv)) {
    failures.push("ALLOW_DEMO_USERS=0 should disable demo seed");
  } else console.log("ok  ALLOW_DEMO_USERS=0 disables demo seed");
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

  const previewHost =
    "https://soft-spark-git-cursor-soft-spark-roam-1c98a3-cameronjgroff-2605.vercel.app";
  if (!isSoftSparkVercelWebOrigin(previewHost)) {
    failures.push("Soft Spark Vercel preview origin must be allowed for Hobby PR smoke");
  } else if (isSoftSparkVercelWebOrigin("https://evil.vercel.app")) {
    failures.push("other vercel.app apps must not be CORS-allowed");
  } else console.log("ok  Soft Spark Vercel preview origin allowlist");

  const ctx = await bootstrap({ pglite: new PGlite() });
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

  const previewOrigin =
    "https://soft-spark-git-cursor-soft-spark-roam-1c98a3-cameronjgroff-2605.vercel.app";
  const previewPreflight = await app.request("/auth/sign-up/email", {
    method: "OPTIONS",
    headers: {
      Origin: previewOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,authorization",
    },
  });
  if (
    previewPreflight.status !== 204 ||
    previewPreflight.headers.get("access-control-allow-origin") !== previewOrigin
  ) {
    failures.push(
      `auth OPTIONS CORS for Soft Spark Vercel preview expected 204 + ACAO, got ${previewPreflight.status} origin=${previewPreflight.headers.get("access-control-allow-origin")}`
    );
  } else console.log("ok  OPTIONS /auth/* CORS for Soft Spark Vercel preview origin");

  const otherVercel = await app.request("/auth/sign-up/email", {
    method: "OPTIONS",
    headers: {
      Origin: "https://evil.vercel.app",
      "Access-Control-Request-Method": "POST",
    },
  });
  if (otherVercel.headers.get("access-control-allow-origin") === "https://evil.vercel.app") {
    failures.push("auth OPTIONS must not echo a different vercel.app Origin");
  } else console.log("ok  OPTIONS /auth/* does not reflect other vercel.app apps");

  const previewMe = await app.request("/users/me", { headers: { Origin: previewOrigin } });
  if (previewMe.headers.get("access-control-allow-origin") !== previewOrigin) {
    failures.push(
      `GET /users/me preview Origin must echo ACAO (else browser Failed to fetch), got ${previewMe.headers.get("access-control-allow-origin")}`
    );
  } else console.log("ok  GET /users/me echoes Soft Spark Vercel preview Origin");

  const previewSignUp = await app.request("/auth/sign-up/email", {
    method: "POST",
    headers: { Origin: previewOrigin, "content-type": "application/json" },
    body: JSON.stringify({
      email: "preview.cors@softspark.dev",
      password: "spark-demo-preview-cors",
      name: "Preview",
    }),
  });
  const previewSignUpBody = await json<{ user?: { id?: string }; message?: string; code?: string }>(previewSignUp);
  if (previewSignUp.status >= 400 || !previewSignUpBody.user?.id) {
    failures.push(
      `ensureGuest sign-up from Soft Spark Vercel preview expected 2xx, got ${previewSignUp.status} ${JSON.stringify(previewSignUpBody)}`
    );
  } else if (previewSignUp.headers.get("access-control-allow-origin") !== previewOrigin) {
    failures.push("preview sign-up must echo ACAO so the browser can read the Bearer token");
  } else console.log("ok  POST /auth/sign-up/email from Soft Spark Vercel preview (ensureGuest)");

  const unauth = await app.request("/matches");
  if (unauth.status !== 401) failures.push(`protected /matches expected 401, got ${unauth.status}`);
  else console.log("ok  unauthenticated GET /matches → 401");

  await assertInternalRouteLock(app, failures);

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
  const mayaProfile = await json<{
    photoUrl?: string;
    height?: string;
    heightCm?: number;
    likes?: string[];
    hair?: string;
    hairColor?: string;
    eyes?: string;
    eyeColor?: string;
    city?: string;
    neighborhood?: string;
    hobbies?: string[];
    gender?: string;
    lookingForGender?: string;
    prefs?: {
      intent?: string;
      lookingFor?: string;
      lookingForGender?: string;
      ageRangeMin?: number;
      ageRangeMax?: number;
    };
  }>(await app.request("/users/me", { headers: { cookie: mayaAuth.cookie } }));
  if (mayaProfile.photoUrl !== MAYA.photoUrl) failures.push("onboard did not persist photoUrl");
  else console.log("ok  onboard Maya + Jordan (User + DatingBot + photoUrl)");
  if (
    mayaProfile.height !== MAYA.profile.height ||
    !mayaProfile.likes?.includes("pasta") ||
    mayaProfile.eyeColor !== "brown" ||
    mayaProfile.city !== "Denver" ||
    mayaProfile.neighborhood !== "Capitol Hill" ||
    !mayaProfile.hobbies?.includes("hiking")
  ) {
    failures.push(`onboard did not persist Edgar v1 profile: ${JSON.stringify(mayaProfile)}`);
  } else console.log("ok  onboard persisted Edgar v1 fields (likes / hobbies / height / hair / eyes / city)");
  if (
    mayaProfile.gender !== "female" ||
    mayaProfile.lookingForGender !== "male" ||
    mayaProfile.prefs?.intent !== "relationship"
  ) {
    failures.push(`onboard did not persist Spark gender/intent: ${JSON.stringify(mayaProfile)}`);
  } else console.log("ok  onboard persisted Spark gender / lookingForGender / intent");
  if (mayaProfile.prefs && "lookingFor" in mayaProfile.prefs && mayaProfile.prefs.lookingFor != null) {
    failures.push("UserDto prefs must not overload lookingFor — use intent + lookingForGender");
  } else console.log("ok  UserDto prefs.intent is not overloaded onto lookingFor");
  if (
    mayaProfile.heightCm !== 168 ||
    mayaProfile.hair !== "dark brown" ||
    mayaProfile.eyes !== "brown" ||
    mayaProfile.prefs?.ageRangeMin !== 25 ||
    mayaProfile.prefs?.ageRangeMax !== 40
  ) {
    failures.push(`onboard did not persist Spark heightCm/hair/eyes/ageRange: ${JSON.stringify(mayaProfile)}`);
  } else console.log("ok  onboard persisted Spark heightCm / hair / eyes / age range");

  const mayaBot = await json<{
    displayName?: string;
    botDisplayName?: string;
    vibeLine?: string;
    publishedAt?: string;
    preferredAction?: string;
    roamStatus?: string;
    styleTags?: string[];
  }>(await app.request("/users/me/bot", { headers: { cookie: mayaAuth.cookie } }));
  if (mayaBot.displayName !== "Ember" || !mayaBot.publishedAt || mayaBot.preferredAction !== "wait") {
    failures.push(`onboard bot name/publish missing: ${JSON.stringify(mayaBot)}`);
  } else if (mayaBot.roamStatus !== "paused" || !mayaBot.styleTags?.includes("Curious")) {
    failures.push(`onboard roamStatus/styleTags missing: ${JSON.stringify(mayaBot)}`);
  } else if (mayaBot.botDisplayName !== "Ember" || mayaBot.vibeLine !== "Denver nights, italian food") {
    failures.push(`onboard botDisplayName/vibeLine missing: ${JSON.stringify(mayaBot)}`);
  } else console.log("ok  Maya named bot Ember and published (wait / paused)");

  const leanAuth = await signUp(app, {
    email: "lean@softspark.dev",
    password: "spark-demo-lean",
    name: "Lean",
  });
  const leanOnboard = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: leanAuth.cookie },
    body: JSON.stringify({
      botDatingOptIn: true,
      profile: { displayName: "Lean", age: 28, gender: "woman", interestedIn: ["man"] },
      prefs: { cuisine: ["italian"], budget: 2, maxTravelKm: 15, dealbreakers: [] },
      homeGeo: { lat: 39.74, lng: -104.98 },
    }),
  });
  if (leanOnboard.status >= 400) {
    failures.push(`legacy onboard without new fields failed ${leanOnboard.status} ${await leanOnboard.text()}`);
  } else console.log("ok  legacy onboard body (no botName / likes) still creates a profile");

  const leanPublish = await json<{
    publishedAt?: string;
    preferredAction?: string;
    displayName?: string;
    roamStatus?: string;
  }>(
    await app.request("/users/me/bot/publish", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: leanAuth.cookie },
      body: JSON.stringify({ preferredAction: "roam" }),
    })
  );
  if (!leanPublish.publishedAt || leanPublish.preferredAction !== "roam" || leanPublish.roamStatus !== "roaming") {
    failures.push(`publish roam failed: ${JSON.stringify(leanPublish)}`);
  } else console.log("ok  POST /users/me/bot/publish → roam / roaming");

  const roamSignUp = await app.request("/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "roam.bearer@softspark.dev",
      password: "spark-demo-roam-bearer",
      name: "Roam",
    }),
  });
  const roamCookie = cookiesFrom(roamSignUp);
  const roamAuth = await json<{ token?: string; user?: { id?: string } }>(roamSignUp);
  const roamToken =
    roamAuth.token ??
    roamCookie
      .split("; ")
      .find((part) => part.startsWith("better-auth.session_token="))
      ?.slice("better-auth.session_token=".length);
  if (roamSignUp.status >= 400 || !roamToken) {
    failures.push(
      `Bearer sign-up should return a token for Hobby web, got ${roamSignUp.status} ${JSON.stringify(roamAuth)}`
    );
  } else {
    const bearer = { authorization: `Bearer ${roamToken}`, "content-type": "application/json" };
    const roamOnboard = await app.request("/users/me/onboard", {
      method: "POST",
      headers: bearer,
      body: JSON.stringify({
        botDatingOptIn: true,
        profile: { displayName: "Roam", age: 28, gender: "woman", interestedIn: ["man"] },
        prefs: { cuisine: ["italian"], budget: 2, maxTravelKm: 15, dealbreakers: [] },
        homeGeo: { lat: 39.74, lng: -104.98 },
      }),
    });
    if (roamOnboard.status >= 400) {
      failures.push(`Bearer-only onboard expected 2xx, got ${roamOnboard.status} ${await roamOnboard.text()}`);
    }
    const roamPublish = await app.request("/users/me/bot/publish", {
      method: "POST",
      headers: bearer,
      body: JSON.stringify({ preferredAction: "roam" }),
    });
    const roamPublished = await json<{ publishedAt?: string; roamStatus?: string; error?: string }>(roamPublish);
    if (roamPublish.status >= 400 || !roamPublished.publishedAt || roamPublished.roamStatus !== "roaming") {
      failures.push(`Bearer-only publish expected roaming, got ${roamPublish.status} ${JSON.stringify(roamPublished)}`);
    }
    const roamMatches = await app.request("/matches", { headers: { authorization: bearer.authorization } });
    const roamBot = await app.request("/users/me/bot", { headers: { authorization: bearer.authorization } });
    if (roamMatches.status !== 200) {
      failures.push(`Bearer GET /matches after publish expected 200 not onboard, got ${roamMatches.status}`);
    } else if (roamBot.status !== 200) {
      failures.push(`Bearer GET /users/me/bot after publish expected 200, got ${roamBot.status}`);
    } else {
      console.log("ok  Bearer-only publish → GET /matches (Hobby token, no cookie)");
    }
  }

  const leanNamed = await json<{ displayName?: string }>(
    await app.request("/users/me/bot", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: leanAuth.cookie },
      body: JSON.stringify({ displayName: "Spark" }),
    })
  );
  if (leanNamed.displayName !== "Spark") failures.push("PATCH bot displayName should stick");
  else console.log("ok  user can name their bot after onboard");

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
    headers: { "content-type": "application/json", cookie: mayaAuth.cookie },
    body: JSON.stringify({ carryCue: "red tote" }),
  });
  const afterMaya = await json<MatchRes>(a1);
  if (afterMaya.invite?.you !== "accepted" || afterMaya.state !== "invited") {
    failures.push("after Maya accept expected waiting on Jordan");
  } else console.log("ok  Maya accept → waiting on Jordan");
  if (afterMaya.invite?.youCarryCue !== "red tote") {
    failures.push(`Maya carry cue missing after accept: ${JSON.stringify(afterMaya.invite)}`);
  } else console.log("ok  Maya carry cue persisted on accept");

  const jordanSeesCue = await json<MatchRes>(
    await app.request(`/matches/${match.id}`, { headers: { cookie: jordanAuth.cookie } })
  );
  if (jordanSeesCue.invite?.themCarryCue !== "red tote") {
    failures.push("Jordan should see Maya’s carry cue before accepting");
  } else console.log("ok  peer can see carry cue on the invite card");

  if (!seenRealtime.includes("invite.accepted")) {
    failures.push("peer did not receive invite.accepted realtime event");
  } else console.log("ok  realtime invite.accepted pushed to peer (no full refresh)");

  unsub();

  const a2 = await app.request(`/matches/${match.id}/invites/${inviteId}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: jordanAuth.cookie },
    body: JSON.stringify({ carryCue: "blue jacket" }),
  });
  const booked = await json<MatchRes>(a2);
  if (booked.state !== "booked") failures.push(`expected booked, got ${booked.state}`);
  else console.log("ok  dual accept → booked");
  if (booked.invite?.youCarryCue !== "blue jacket" || booked.invite?.themCarryCue !== "red tote") {
    failures.push(`Jordan booked invite missing both carry cues: ${JSON.stringify(booked.invite)}`);
  } else console.log("ok  both carry cues visible after dual accept");

  const mayaBooked = await json<MatchRes>(
    await app.request(`/matches/${match.id}`, { headers: { cookie: mayaAuth.cookie } })
  );
  if (mayaBooked.invite?.youCarryCue !== "red tote" || mayaBooked.invite?.themCarryCue !== "blue jacket") {
    failures.push("Maya should see both carry cues after booking");
  } else console.log("ok  Maya sees both IRL carry cues (no transcript)");

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

  const unauthSearch = await app.request("/matches/search", { method: "POST", body: "{}" });
  if (unauthSearch.status !== 401) {
    failures.push(`POST /matches/search unauth expected 401, got ${unauthSearch.status}`);
  } else console.log("ok  POST /matches/search requires a session");

  const mayaSearch = await json<{
    found?: boolean;
    estimatedSeconds?: number;
    match?: { id: string; state: string; confidence?: number };
  }>(
    await app.request("/matches/search", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: mayaAuth.cookie },
      body: "{}",
    })
  );
  const searchRaw = JSON.stringify(mayaSearch);
  if (searchRaw.includes('"confidence"') || searchRaw.includes("transcript") || /"messages"\s*:/.test(searchRaw)) {
    failures.push("POST /matches/search leaked confidence, transcript, or messages[]");
  }
  if (!mayaSearch.found || mayaSearch.match?.id !== match.id || typeof mayaSearch.estimatedSeconds !== "number") {
    failures.push(`POST /matches/search should return Maya’s existing match + ETA, got ${searchRaw}`);
  } else console.log(`ok  POST /matches/search → existing ${mayaSearch.match?.state} + ETA ${mayaSearch.estimatedSeconds}s`);

  const samAuth = await signUp(app, {
    email: "sam@softspark.dev",
    password: "spark-demo-sam",
    name: "Sam",
  });
  const samOnboard = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: samAuth.cookie },
    body: JSON.stringify({ ...JORDAN, profile: { ...JORDAN.profile, displayName: "Sam" } }),
  });
  if (samOnboard.status >= 400) {
    failures.push(`Sam onboard for search failed ${samOnboard.status}`);
  }
  const samSearch = await json<{ found?: boolean; match?: { id: string; state: string } }>(
    await app.request("/matches/search", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: samAuth.cookie },
      body: "{}",
    })
  );
  if (!samSearch.found || !samSearch.match?.id) {
    failures.push(`POST /matches/search should create/find a stub match for a new user, got ${JSON.stringify(samSearch)}`);
  } else console.log(`ok  POST /matches/search new user → ${samSearch.match.state}`);

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
  if (typeof health.env?.demoUsers !== "boolean") failures.push("health missing env.demoUsers");
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
    const first = await bootstrap({ dataDir });
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

    const second = await bootstrap({ dataDir });
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

  const seedCtx = await bootstrap({ pglite: new PGlite() });
  try {
    const seedApp = createApp(seedCtx);
    const wrongMaya = await seedApp.request("/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: DEMO_ACCOUNTS.maya.email,
        password: "not-the-ui-password-1",
        name: "Maya",
      }),
    });
    if (wrongMaya.status >= 400) {
      failures.push(`pre-seed Maya sign-up failed ${wrongMaya.status}`);
    }
    const seeded = await ensureDemoUsers({
      app: seedApp,
      auth: seedCtx.auth,
      db: seedCtx.db,
      store: seedCtx.store,
      events: seedCtx.events,
      hub: seedCtx.hub,
      push: seedCtx.push,
    });
    const mayaSignIn = await seedApp.request("/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: DEMO_ACCOUNTS.maya.email,
        password: DEMO_ACCOUNTS.maya.password,
      }),
    });
    const jordanSignIn = await seedApp.request("/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: DEMO_ACCOUNTS.jordan.email,
        password: DEMO_ACCOUNTS.jordan.password,
      }),
    });
    if (mayaSignIn.status >= 400) {
      failures.push(
        `Maya UI credential sign-in failed ${mayaSignIn.status} ${await mayaSignIn.text()}`
      );
    } else console.log("ok  Maya demo email/password sign-in after seed");
    if (jordanSignIn.status >= 400) {
      failures.push(
        `Jordan UI credential sign-in failed ${jordanSignIn.status} ${await jordanSignIn.text()}`
      );
    } else console.log("ok  Jordan demo email/password sign-in after seed");

    const mayaCookie = cookiesFrom(mayaSignIn);
    const mayaMe = await json<{ displayName?: string }>(
      await seedApp.request("/users/me", { headers: { cookie: mayaCookie } })
    );
    if (mayaMe.displayName !== "Maya") {
      failures.push(`seeded Maya /users/me expected onboarded Maya, got ${JSON.stringify(mayaMe)}`);
    } else console.log("ok  seeded Maya is onboarded (not profile_incomplete)");

    const mayaMatches = await json<{ id: string; state: string }[]>(
      await seedApp.request("/matches", { headers: { cookie: mayaCookie } })
    );
    if (!Array.isArray(mayaMatches) || mayaMatches.length < 1) {
      failures.push("seeded Maya should land on a match list with at least one match");
    } else console.log(`ok  seeded Maya GET /matches → ${mayaMatches[0]?.state}`);

    const again = await ensureDemoUsers({
      app: seedApp,
      auth: seedCtx.auth,
      db: seedCtx.db,
      store: seedCtx.store,
      events: seedCtx.events,
      hub: seedCtx.hub,
      push: seedCtx.push,
    });
    if (again.mayaUserId !== seeded.mayaUserId || again.jordanUserId !== seeded.jordanUserId) {
      failures.push("ensureDemoUsers should be idempotent (same profile ids)");
    } else console.log("ok  ensureDemoUsers is idempotent");
  } finally {
    await seedCtx.close();
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
