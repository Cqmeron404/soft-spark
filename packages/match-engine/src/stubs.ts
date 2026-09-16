import {
  CONSTANTS,
  phaseForTurn,
  safetyCheckMessage,
  scoreMatch,
  suggestVenue,
} from "./logic";
import { DENVER_PLACES } from "./places";
import type {
  BotTurnInput,
  BotTurnResult,
  ChemistryDims,
  ConversationRunner,
  MatchScorer,
  Place,
  SafetyGate,
  SafetyResult,
  ScoreContext,
  SuggestVenueInput,
  SuggestVenueResult,
  UserProfileSnapshot,
  VenueSuggester,
} from "./types";

/** High-enough dims that typical overlapping Denver profiles clear 0.75. */
export const HAPPY_PATH_DIMS: ChemistryDims = {
  reciprocity: 0.82,
  curiosity: 0.8,
  valueAlignment: 0.78,
  emotionalSafety: 0.85,
  sharedSpark: 0.8,
};

const PHASE_LINES: Record<ReturnType<typeof phaseForTurn>, string[]> = {
  open: [
    "Hey — curious what a good weekend looks like for your human.",
    "Starting light: favorite neighborhood energy, not the resume.",
  ],
  explore: [
    "Food and pace matter a lot here. What kind of table feels easy?",
    "I'm noticing overlapping interests — want to unpack that a bit?",
    "Values check: how do they like to spend an evening with someone new?",
    "Travel and timing seem workable. Still curious about the vibe match.",
  ],
  spark: [
    "There's a real spark around humor and shared pace.",
    "This is starting to feel like people who would actually enjoy a table together.",
  ],
  close: [
    "I think this is worth an in-person hello if a midpoint works.",
    "Wrapping up — chemistry feels strong enough to leave it to the humans.",
  ],
};

export type ScoreContextGetter = (matchId: string) => Promise<ScoreContext>;

export function createStubMatchScorer(getContext: ScoreContextGetter): MatchScorer {
  return {
    async score(matchId: string) {
      const ctx = await getContext(matchId);
      return scoreMatch({
        matchId,
        a: ctx.a,
        b: ctx.b,
        chemistryDims: ctx.chemistryDims,
        safetyOk: ctx.safetyOk,
      });
    },
  };
}

export function createStubConversationRunner(): ConversationRunner {
  return {
    async runBotTurn(input: BotTurnInput): Promise<BotTurnResult> {
      const turn = input.history.length + 1;
      const phase = phaseForTurn(turn);
      const lines = PHASE_LINES[phase];
      const text = lines[(turn - 1) % lines.length] ?? lines[0];
      const safety = safetyCheckMessage(text);
      return { text, safety };
    },
  };
}

export function createStubSafetyGate(): SafetyGate {
  return {
    async checkMessage(text: string): Promise<SafetyResult> {
      return safetyCheckMessage(text);
    },
    async checkMatch(): Promise<SafetyResult> {
      return { ok: true };
    },
  };
}

export function createStubVenueSuggester(options?: {
  places?: Place[];
  empty?: boolean;
}): VenueSuggester {
  const places = options?.places ?? DENVER_PLACES;
  return {
    async suggestVenue(input: SuggestVenueInput): Promise<SuggestVenueResult> {
      if (options?.empty) return { candidates: [] };
      const asSnapshot = (u: SuggestVenueInput["userA"]): UserProfileSnapshot => ({
        looking_for: "unsure",
        age: 30,
        gender: "unspecified",
        interested_in: [],
        homeGeo: u.homeGeo,
        cuisine: u.cuisine,
        budget: u.budget,
        maxTravelKm: u.maxTravelKm,
        dealbreakers: [],
        interests: [],
        vibeTags: [],
      });
      const candidates = suggestVenue({
        a: asSnapshot(input.userA),
        b: asSnapshot(input.userB),
        places,
      });
      return { candidates };
    },
  };
}

export function dimsForTurn(turn: number, happyPath = true): ChemistryDims {
  if (happyPath) return { ...HAPPY_PATH_DIMS };
  const t = Math.min(turn, CONSTANTS.MAX_TURNS) / CONSTANTS.MAX_TURNS;
  const v = 0.4 + 0.45 * t;
  return {
    reciprocity: v,
    curiosity: v,
    valueAlignment: v * 0.95,
    emotionalSafety: 0.7,
    sharedSpark: v * 0.9,
  };
}
