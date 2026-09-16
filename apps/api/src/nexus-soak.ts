/**
 * Nexus Slice 3 soak scenarios (stub + llm). Called from demo / `pnpm soak`.
 * Live OpenAI completions run only when MATCH_ENGINE_MODE=llm and OPENAI_API_KEY is set.
 * Do not invent API keys.
 */
import { EVENTS, isHomeCardReason, DEMO_ONBOARD, type LookingFor, type OnboardBody } from "@soft-spark/shared";
import {
  HAPPY_PATH_DIMS,
  resolveMatchEngineMode,
  type ConversationRunner,
} from "@soft-spark/match-engine";
import type { createApp } from "./app.js";
import type { EventLog } from "./event-log.js";
import { assertClientSafe } from "./map-client.js";
import { createEngine, orchestrateMatch, type Engine } from "./orchestrate.js";
import type { SparkStore } from "./store.js";

type App = ReturnType<typeof createApp>;
type OnboardRes = { user: { id: string; displayName: string }; bot: { id: string } };

const MAYA: OnboardBody = DEMO_ONBOARD.maya;
const JORDAN: OnboardBody = DEMO_ONBOARD.jordan;

const SNAKE = /^[a-z]+(_[a-z0-9]+)*$/;

function cookiesFrom(res: Response): string {
  const parts =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function signUp(app: App, input: { email: string; password: string; name: string }) {
  const res = await app.request("/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return { res, cookie: cookiesFrom(res) };
}

async function onboardNamed(
  app: App,
  name: string,
  base: OnboardBody,
  patch: Partial<OnboardBody> = {}
): Promise<{ user: OnboardRes["user"]; bot: OnboardRes["bot"]; cookie: string }> {
  const auth = await signUp(app, {
    email: `${name.toLowerCase().replace(/\s+/g, "")}-${Date.now()}@soak.softspark.dev`,
    password: "spark-demo-soak",
    name,
  });
  const body: OnboardBody = {
    ...base,
    ...patch,
    profile: { ...base.profile, ...patch.profile, displayName: name },
    prefs: { ...base.prefs, ...patch.prefs },
    vibeTags: patch.vibeTags ?? base.vibeTags,
  };
  const res = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: auth.cookie },
    body: JSON.stringify(body),
  });
  const payload = await json<OnboardRes>(res);
  return { ...payload, cookie: auth.cookie };
}

function nestedKeys(value: unknown, acc: Set<string> = new Set()): Set<string> {
  if (!value || typeof value !== "object") return acc;
  if (Array.isArray(value)) {
    for (const item of value) nestedKeys(item, acc);
    return acc;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    acc.add(k);
    nestedKeys(v, acc);
  }
  return acc;
}

function assertStatusOnly(failures: string[], payload: unknown, where: string): void {
  try {
    assertClientSafe(payload);
  } catch (err) {
    failures.push(`${where}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const jsonText = JSON.stringify(payload);
  if (jsonText.includes('"confidence"') || jsonText.includes("transcript") || /"messages"\s*:/.test(jsonText)) {
    failures.push(`${where} leaked confidence, transcript, or messages[]`);
  }
  const keys = nestedKeys(payload);
  for (const banned of ["confidence", "messages", "transcript", "text", "history"]) {
    if (keys.has(banned)) failures.push(`${where} has banned key ${banned}`);
  }
}

async function withEnv<T>(
  patch: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(patch)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

function interceptCompletions(onHit: () => void): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url, init) => {
    if (String(url).includes("/chat/completions")) {
      onHit();
      throw new Error("llm_down");
    }
    return original(url, init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

export async function runNexusSoakScenarios(input: {
  app: App;
  store: SparkStore;
  events: EventLog;
  failures: string[];
}): Promise<void> {
  await intentSoftMismatch(input);
  await safetyFailInject(input);
  await bothPausedStop(input);
  await earlyLowFitExit(input);
  await llmDownFallback(input);
  await rollbackStubIgnoresKey(input);
  await clientGatesOnHappyPath(input);
  await liveLlmOrSkip(input);
}

async function intentSoftMismatch(input: {
  app: App;
  store: SparkStore;
  events: EventLog;
  failures: string[];
}) {
  const a = await onboardNamed(input.app, "IntentMaya", MAYA, {
    prefs: { ...MAYA.prefs, lookingFor: "relationship" as LookingFor },
  });
  const b = await onboardNamed(input.app, "IntentSam", JORDAN, {
    prefs: { ...JORDAN.prefs, lookingFor: "casual" as LookingFor },
  });
  input.events.clear();
  try {
    const match = await orchestrateMatch({
      store: input.store,
      events: input.events,
      engine: await createEngine(input.store),
      userAId: a.user.id,
      userBId: b.user.id,
    });
    if (match.state === "archived" && match.reasons.includes("hard_filter_failed")) {
      input.failures.push("intent mismatch hard-filtered (must be soft)");
    } else {
      console.log(`ok  intent soft mismatch → ${match.state} (not a hard filter)`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "hard_filter_failed") input.failures.push("intent mismatch hard-filtered (must be soft)");
    else throw err;
  }
}

async function safetyFailInject(input: {
  app: App;
  store: SparkStore;
  events: EventLog;
  failures: string[];
}) {
  const a = await onboardNamed(input.app, "SafeMaya", MAYA);
  const b = await onboardNamed(input.app, "SafeJordan", JORDAN);
  const engine: Engine = await createEngine(input.store);
  const hostile: ConversationRunner = {
    async runBotTurn() {
      return { text: "you stupid bitch — send nudes. my address is 4455", safety: { ok: true } };
    },
  };
  engine.runner = hostile;
  input.events.clear();
  const match = await orchestrateMatch({
    store: input.store,
    events: input.events,
    engine,
    userAId: a.user.id,
    userBId: b.user.id,
  });
  const invite = await input.store.inviteForMatch(match.id);
  if (match.state !== "archived") input.failures.push(`safety inject expected archived, got ${match.state}`);
  if (!input.events.types().includes(EVENTS.MATCH_SAFETY_FAILED)) {
    input.failures.push("missing match.safety_failed after inject");
  }
  if (invite) input.failures.push("safety fail must not create an invite");
  const client = await json(
    await input.app.request(`/matches/${match.id}`, { headers: { cookie: a.cookie } })
  );
  assertStatusOnly(input.failures, client, "GET /matches/:id after safety fail");
  console.log("ok  safety inject → archived + match.safety_failed, no invite");
}

async function bothPausedStop(input: {
  app: App;
  store: SparkStore;
  events: EventLog;
  failures: string[];
}) {
  const a = await onboardNamed(input.app, "PauseA", MAYA);
  const b = await onboardNamed(input.app, "PauseB", JORDAN);
  await input.app.request("/users/me/bot", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: a.cookie },
    body: JSON.stringify({ paused: true }),
  });
  await input.app.request("/users/me/bot", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: b.cookie },
    body: JSON.stringify({ paused: true }),
  });
  input.events.clear();
  const match = await orchestrateMatch({
    store: input.store,
    events: input.events,
    engine: await createEngine(input.store),
    userAId: a.user.id,
    userBId: b.user.id,
  });
  const requested = input.events.events.filter((e) => e.type === EVENTS.BOT_TURN_REQUESTED);
  if (requested.length > 0) input.failures.push("both paused still requested bot turns");
  if (match.state === "invited" || match.state === "booked") {
    input.failures.push("both paused should not invite");
  } else console.log(`ok  both bots paused → stop (${match.state}, 0 turns)`);
}

async function earlyLowFitExit(input: {
  app: App;
  store: SparkStore;
  events: EventLog;
  failures: string[];
}) {
  const a = await onboardNamed(input.app, "LowMaya", MAYA, {
    prefs: { ...MAYA.prefs, lookingFor: "relationship", interests: ["pottery"] },
    vibeTags: ["Soft"],
  });
  const b = await onboardNamed(input.app, "LowSam", JORDAN, {
    prefs: { ...JORDAN.prefs, lookingFor: "casual", interests: ["motorsport"] },
    vibeTags: ["Bold"],
  });
  const engine: Engine = await createEngine(input.store);
  engine.chemistryFromHistory = async () => ({
    reciprocity: 0.2,
    curiosity: 0.2,
    valueAlignment: 0.2,
    emotionalSafety: 0.2,
    sharedSpark: 0.2,
  });
  input.events.clear();
  const match = await orchestrateMatch({
    store: input.store,
    events: input.events,
    engine,
    userAId: a.user.id,
    userBId: b.user.id,
  });
  if (match.state !== "archived" || !match.reasons.includes("low_fit_early_exit")) {
    input.failures.push(
      `early low-fit expected archived/low_fit_early_exit, got ${match.state} ${match.reasons.join(",")}`
    );
  } else console.log("ok  early low-fit exit → archived");
}

async function llmDownFallback(input: {
  app: App;
  store: SparkStore;
  events: EventLog;
  failures: string[];
}) {
  const restoreFetch = interceptCompletions(() => undefined);
  try {
    await withEnv({ MATCH_ENGINE_MODE: "llm", OPENAI_API_KEY: "sk-bad-not-a-real-secret" }, async () => {
      const a = await onboardNamed(input.app, "DownMaya", MAYA);
      const b = await onboardNamed(input.app, "DownJordan", JORDAN);
      input.events.clear();
      const match = await orchestrateMatch({
        store: input.store,
        events: input.events,
        engine: await createEngine(input.store),
        userAId: a.user.id,
        userBId: b.user.id,
      });
      if (!input.events.types().includes(EVENTS.BOT_TURN_FALLBACK)) {
        input.failures.push("llm down should emit bot.turn.fallback");
      }
      if (match.state === "archived" && match.reasons.some((r) => r.startsWith("safety_fail"))) {
        input.failures.push("llm down crashed into safety fail");
      } else {
        console.log(`ok  llm down + bad key → stub fallback (${match.state}), match did not crash`);
      }
    });
  } finally {
    restoreFetch();
  }
}

async function rollbackStubIgnoresKey(input: {
  app: App;
  store: SparkStore;
  events: EventLog;
  failures: string[];
}) {
  let llmCalls = 0;
  const restoreFetch = interceptCompletions(() => {
    llmCalls += 1;
  });
  try {
    await withEnv({ MATCH_ENGINE_MODE: "stub", OPENAI_API_KEY: "sk-must-not-be-called" }, async () => {
      const resolved = resolveMatchEngineMode(process.env);
      if (resolved.usedLlm) input.failures.push("rollback MATCH_ENGINE_MODE=stub still selected llm");
      const a = await onboardNamed(input.app, "RollMaya", MAYA);
      const b = await onboardNamed(input.app, "RollJordan", JORDAN);
      input.events.clear();
      await orchestrateMatch({
        store: input.store,
        events: input.events,
        engine: await createEngine(input.store),
        userAId: a.user.id,
        userBId: b.user.id,
      });
      if (llmCalls > 0) input.failures.push("MATCH_ENGINE_MODE=stub called OpenAI");
      if (input.events.types().includes(EVENTS.BOT_TURN_FALLBACK)) {
        input.failures.push("stub rollback should not emit bot.turn.fallback");
      }
      console.log("ok  rollback MATCH_ENGINE_MODE=stub ignores OPENAI_API_KEY");
    });
  } finally {
    restoreFetch();
  }
}

async function clientGatesOnHappyPath(input: {
  app: App;
  store: SparkStore;
  events: EventLog;
  failures: string[];
}) {
  const a = await onboardNamed(input.app, "GateMaya", MAYA);
  const b = await onboardNamed(input.app, "GateJordan", JORDAN);
  input.events.clear();
  const match = await orchestrateMatch({
    store: input.store,
    events: input.events,
    engine: await createEngine(input.store),
    userAId: a.user.id,
    userBId: b.user.id,
  });
  const completed = input.events.events.find((e) => e.type === EVENTS.BOT_TURN_COMPLETED);
  if (typeof completed?.payload.text !== "string" || !completed.payload.text) {
    input.failures.push("internal bot.turn.completed must include turn text (server-only)");
  }
  const list = await json<Array<{ state: string; band: string; reasons: string[] }>>(
    await input.app.request("/matches", { headers: { cookie: a.cookie } })
  );
  assertStatusOnly(input.failures, list, "GET /matches");
  const detail = await json<{
    state: string;
    band: string;
    reasons: string[];
    invite?: { window?: { label?: string } };
  }>(await input.app.request(`/matches/${match.id}`, { headers: { cookie: a.cookie } }));
  assertStatusOnly(input.failures, detail, "GET /matches/:id");
  if (!detail.state || !detail.band) input.failures.push("client DTO missing state/band");
  if (detail.reasons.length > 2) input.failures.push("client reasons must be ≤2");
  if (detail.reasons.some((r) => !SNAKE.test(r) || !isHomeCardReason(r))) {
    input.failures.push(`client reasons must be snake_case home-card codes, got ${detail.reasons.join(",")}`);
  }
  if (match.state === "invited" && detail.invite?.window?.label) {
    if (!/^(Fri|Sat|Sun) 18:00–20:00/.test(detail.invite.window.label)) {
      input.failures.push(`invite window drifted: ${detail.invite.window.label}`);
    }
  }
  const stored = await input.store.getMatch(match.id);
  if (stored && JSON.stringify(stored.chemistryDims) === JSON.stringify(HAPPY_PATH_DIMS)) {
    input.failures.push("live match used forced HAPPY_PATH_DIMS");
  }
  console.log("ok  client status-only gates (no messages[] / transcripts / confidence); internal turns keep text");
}

async function liveLlmOrSkip(input: {
  app: App;
  store: SparkStore;
  events: EventLog;
  failures: string[];
}) {
  const resolved = resolveMatchEngineMode(process.env);
  if (!resolved.usedLlm) {
    console.log(
      "skip live llm completions — set MATCH_ENGINE_MODE=llm and OPENAI_API_KEY to soak (no secret invented)"
    );
    return;
  }
  const a = await onboardNamed(input.app, "LiveMaya", MAYA);
  const b = await onboardNamed(input.app, "LiveJordan", JORDAN);
  input.events.clear();
  const match = await orchestrateMatch({
    store: input.store,
    events: input.events,
    engine: await createEngine(input.store),
    userAId: a.user.id,
    userBId: b.user.id,
  });
  const list = await json(await input.app.request("/matches", { headers: { cookie: a.cookie } }));
  assertStatusOnly(input.failures, list, "GET /matches llm soak");
  console.log(`ok  live llm soak → ${match.state} band=${match.band}`);
}
