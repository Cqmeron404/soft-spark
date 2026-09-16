import assert from "node:assert/strict";
import { test } from "node:test";
import { passesHardFilter } from "./hard-filter";
import {
  CONSTANTS,
  canEnterInviteReady,
  earlyExitLowFit,
  profileFit,
  safetyCheckMessage,
} from "./logic";
import { resolveMatchEngineMode } from "./llm";
import {
  overlappingPersonaScore,
  overlappingPersonaTranscript,
  runInviteThresholdRegression,
} from "./regression";
import { HAPPY_PATH_DIMS } from "./stubs";

const MAYA = {
  displayName: "Maya",
  looking_for: "relationship" as const,
  age: 29,
  gender: "woman",
  interested_in: ["man"],
  homeGeo: { lat: 39.739, lng: -104.979 },
  cuisine: ["italian", "american"],
  budget: 3 as const,
  maxTravelKm: 25,
  dealbreakers: [] as string[],
  interests: ["food", "hiking", "live music"],
  vibeTags: ["Curious", "Soft"],
};

const JORDAN = {
  ...MAYA,
  displayName: "Jordan",
  age: 31,
  gender: "man",
  interested_in: ["woman"],
  homeGeo: { lat: 39.759, lng: -104.999 },
  maxTravelKm: 20,
  interests: ["food", "hiking", "design"],
  vibeTags: ["Curious", "Witty"],
};

test("invite_threshold stays 0.75 (persona turns must not drift it)", async () => {
  assert.equal(CONSTANTS.INVITE_THRESHOLD, 0.75);
  const failures = await runInviteThresholdRegression();
  assert.deepEqual(failures, []);
});

test("overlapping Denver personas still clear invite_ready band at 0.75", async () => {
  const scored = await overlappingPersonaScore();
  assert.ok(scored.confidence >= 0.75, `confidence ${scored.confidence}`);
  assert.equal(scored.band, "invite_ready");
  assert.equal(CONSTANTS.INVITE_THRESHOLD, 0.75);
});

test("live chemistry dims come from transcript, not HAPPY_PATH_DIMS", async () => {
  const { dims } = await overlappingPersonaTranscript();
  assert.notDeepEqual(dims, HAPPY_PATH_DIMS);
});

test("rollback MATCH_ENGINE_MODE=stub ignores OPENAI_API_KEY", () => {
  const rollback = resolveMatchEngineMode({
    MATCH_ENGINE_MODE: "stub",
    OPENAI_API_KEY: "sk-should-not-use",
  });
  assert.equal(rollback.usedLlm, false);
  assert.equal(rollback.mode, "stub");

  const noKey = resolveMatchEngineMode({ MATCH_ENGINE_MODE: "llm" });
  assert.equal(noKey.usedLlm, false);
  assert.ok(noKey.log);

  const live = resolveMatchEngineMode({ MATCH_ENGINE_MODE: "llm", OPENAI_API_KEY: "sk-test" });
  assert.equal(live.usedLlm, true);
});

test("safetyCheckMessage flags harassment / sexual_pressure / pii_dump", () => {
  assert.deepEqual(safetyCheckMessage("you stupid bitch"), { ok: false, code: "harassment" });
  assert.deepEqual(safetyCheckMessage("send nudes"), { ok: false, code: "sexual_pressure" });
  assert.deepEqual(safetyCheckMessage("my address is 123 Main"), { ok: false, code: "pii_dump" });
  assert.deepEqual(safetyCheckMessage("What's a good weekend look like?"), { ok: true });
});

test("canEnterInviteReady requires ≥1 venue at threshold 0.75", () => {
  const at = {
    matchId: "x",
    confidence: 0.75,
    band: "invite_ready" as const,
    components: { profileFit: 1, chemistry: 1, logistics: 1 },
    reasons: [] as string[],
    safetyOk: true,
  };
  assert.equal(canEnterInviteReady({ ...at, confidence: 0.749, band: "strong" }, 1).ok, false);
  assert.equal(canEnterInviteReady(at, 1).ok, true);
  const none = canEnterInviteReady(at, 0);
  assert.equal(none.ok, false);
  assert.equal("emit" in none ? none.emit : undefined, "match.venue_unavailable");
});

test("invite window stays Fri–Sun 18:00–20:00", () => {
  assert.equal(CONSTANTS.INVITE_WINDOW.localStart, "18:00");
  assert.equal(CONSTANTS.INVITE_WINDOW.localEnd, "20:00");
  assert.deepEqual([...CONSTANTS.INVITE_WINDOW.days], ["Fri", "Sat", "Sun"]);
});

test("intent mismatch is a soft penalty, not a hard filter", () => {
  const casual = { ...JORDAN, looking_for: "casual" as const };
  assert.equal(passesHardFilter(MAYA, casual), true);
  assert.ok(profileFit(MAYA, casual).reasons.includes("intent_mismatch"));
});

test("earlyExitLowFit waits until turn 4", () => {
  assert.equal(earlyExitLowFit(3, 0.2, 0.2), false);
  assert.equal(earlyExitLowFit(4, 0.2, 0.2), true);
  assert.equal(earlyExitLowFit(4, 0.5, 0.2), false);
});
