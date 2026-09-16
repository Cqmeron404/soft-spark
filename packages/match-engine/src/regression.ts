/**
 * Slice 3 safety / soak set — persona turns must not drift invite_threshold 0.75.
 * Clients never see confidence / transcripts / messages[].
 */
import { chemistryFromTranscript } from "./chemistry-from-transcript";
import { CONSTANTS, canEnterInviteReady, scoreMatch } from "./logic";
import { createLlmConversationRunner } from "./llm";
import { buildBotTurnPrompt } from "./llm-conversation-runner";
import { createStubConversationRunner } from "./stubs";
import type { BotTurnInput, ScoreResult, UserProfileSnapshot } from "./types";
import { assertPlacesKeyInProd } from "./venue-provider";

const MAYA: UserProfileSnapshot = {
  displayName: "Maya",
  looking_for: "relationship",
  age: 29,
  gender: "woman",
  interested_in: ["man"],
  homeGeo: { lat: 39.739, lng: -104.979 },
  cuisine: ["italian", "american"],
  budget: 3,
  maxTravelKm: 25,
  dealbreakers: [],
  interests: ["food", "hiking", "live music"],
  vibeTags: ["Curious", "Soft"],
};

const JORDAN: UserProfileSnapshot = {
  displayName: "Jordan",
  looking_for: "relationship",
  age: 31,
  gender: "man",
  interested_in: ["woman"],
  homeGeo: { lat: 39.759, lng: -104.999 },
  cuisine: ["italian", "american"],
  budget: 3,
  maxTravelKm: 20,
  dealbreakers: [],
  interests: ["food", "hiking", "design"],
  vibeTags: ["Curious", "Witty"],
};

function turnInput(profile: UserProfileSnapshot, history: BotTurnInput["history"]): BotTurnInput {
  return {
    matchId: "soak",
    botId: "bot",
    userId: "user",
    history,
    profile,
  };
}

export async function overlappingPersonaScore(): Promise<ScoreResult> {
  const runner = createStubConversationRunner();
  const history: BotTurnInput["history"] = [];
  for (let i = 0; i < CONSTANTS.MAX_TURNS; i++) {
    const profile = i % 2 === 0 ? MAYA : JORDAN;
    const result = await runner.runBotTurn(turnInput(profile, history));
    history.push({
      role: i % 2 === 0 ? "botA" : "botB",
      text: result.text,
      at: new Date().toISOString(),
    });
  }
  const dims = chemistryFromTranscript(history.map((m) => ({ role: m.role, text: m.text })));
  return scoreMatch({
    matchId: "soak",
    a: MAYA,
    b: JORDAN,
    chemistryDims: dims,
    safetyOk: true,
  });
}

export async function runInviteThresholdRegression(): Promise<string[]> {
  const failures: string[] = [];
  if (CONSTANTS.INVITE_THRESHOLD !== 0.75) {
    failures.push(`invite_threshold drifted: ${CONSTANTS.INVITE_THRESHOLD} !== 0.75`);
  }
  if (CONSTANTS.W_PROFILE !== 0.35 || CONSTANTS.W_CHEM !== 0.45 || CONSTANTS.W_LOG !== 0.2) {
    failures.push("score weights drifted from 0.35 / 0.45 / 0.20");
  }

  const justUnder: ScoreResult = {
    matchId: "x",
    confidence: 0.749,
    band: "strong",
    components: { profileFit: 1, chemistry: 1, logistics: 1 },
    reasons: [],
    safetyOk: true,
  };
  const at: ScoreResult = { ...justUnder, confidence: 0.75, band: "invite_ready" };
  if (canEnterInviteReady(justUnder, 1).ok) failures.push("0.749 must stay exploring");
  if (!canEnterInviteReady(at, 1).ok) failures.push("0.75 + venue must enter invite_ready");
  const noVenue = canEnterInviteReady(at, 0);
  if (noVenue.ok || noVenue.emit !== "match.venue_unavailable") {
    failures.push("0.75 with 0 venues must emit match.venue_unavailable");
  }

  const scored = await overlappingPersonaScore();
  if (scored.confidence < CONSTANTS.INVITE_THRESHOLD) {
    failures.push(
      `persona turns drifted below 0.75 (confidence=${scored.confidence.toFixed(3)}). Threshold must stay 0.75.`
    );
  }

  const prompt = buildBotTurnPrompt({
    matchId: "p",
    botId: "b",
    userId: "u",
    history: [],
    profile: {
      looking_for: MAYA.looking_for,
      interests: MAYA.interests,
      vibeTags: MAYA.vibeTags,
      age: MAYA.age,
      gender: MAYA.gender,
    },
    displayName: "Maya",
  });
  if (!/No venue plans/.test(prompt) || !/Never invent hard facts/.test(prompt)) {
    failures.push("LLM prompt lost venue/PII grounding");
  }

  const stub = createStubConversationRunner();
  const llmMissingKey = createLlmConversationRunner({ apiKey: undefined }, stub);
  const fb = await llmMissingKey.runBotTurn(turnInput(MAYA, []));
  if (!fb.fallback) failures.push("MATCH_ENGINE_MODE=llm without key should mark stub fallback");

  const llmThrow = createLlmConversationRunner({ apiKey: "sk-test" }, stub);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("network");
  }) as typeof fetch;
  try {
    const fell = await llmThrow.runBotTurn(turnInput(MAYA, []));
    if (!fell.fallback) failures.push("LLM HTTP failure should stub-fallback");
  } finally {
    globalThis.fetch = originalFetch;
  }

  try {
    assertPlacesKeyInProd({ NODE_ENV: "production" });
    failures.push("prod VenueSuggester must require GOOGLE_PLACES_API_KEY");
  } catch {
    /* expected */
  }
  try {
    assertPlacesKeyInProd({ NODE_ENV: "production", GOOGLE_PLACES_API_KEY: "k" });
  } catch {
    failures.push("prod with Places key should not throw");
  }
  try {
    assertPlacesKeyInProd({ NODE_ENV: "development" });
  } catch {
    failures.push("local VenueSuggester should allow catalog without Places key");
  }

  return failures;
}
