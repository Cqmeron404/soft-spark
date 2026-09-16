import {
  CONSTANTS,
  phaseForTurn,
  safetyCheckMessage,
  scoreMatch,
  suggestVenue,
} from "./logic";
import { DENVER_PLACES } from "./places";
import { createCatalogPlaceProvider, createMidpointVenueSuggester } from "./venue-provider";
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

/** High-enough dims that typical overlapping Denver profiles clear 0.75. Tests only. */
export const HAPPY_PATH_DIMS: ChemistryDims = {
  reciprocity: 0.82,
  curiosity: 0.8,
  valueAlignment: 0.78,
  emotionalSafety: 0.85,
  sharedSpark: 0.8,
};

function personaLine(input: BotTurnInput, phase: ReturnType<typeof phaseForTurn>, turn: number): string {
  const name = input.profile.displayName ?? "my human";
  const interest = input.profile.interests[0] ?? "good food";
  const extra = input.profile.interests[1];
  const vibe = input.profile.vibeTags[0]?.toLowerCase() ?? "curious";
  const looking = input.profile.looking_for;
  switch (phase) {
    case "open":
      return turn === 1
        ? `Hey — I speak for ${name}, who's ${vibe} and into ${interest}. What's a good weekend look like on your side?`
        : `Keeping it light: ${name} lights up around ${interest}, not a resume dump. How do they like to spend an evening?`;
    case "explore":
      if (turn === 3) {
        return `They're looking for ${looking}. ${interest} keeps coming up — is that a shared thread for your human too?`;
      }
      if (turn === 4) {
        return extra
          ? `Also noticing ${extra} overlap. What kind of table feels easy — lively or quieter?`
          : `Values check: how do they like to spend an evening with someone new?`;
      }
      if (turn === 5) {
        return `Food and pace matter a lot here. ${name} is ${vibe} about trying new spots, never the logistics.`;
      }
      return `Travel and timing seem workable. Still curious whether ${interest} is a real spark or just small talk.`;
    case "spark":
      return turn === 7
        ? `There's a real spark around ${interest} and a shared ${looking === "casual" ? "easy" : "steady"} pace.`
        : `This is starting to feel like people who would actually enjoy a table together.`;
    default:
      return turn === 9
        ? `I think this is worth an in-person hello if a midpoint works — I'll leave venues to the system.`
        : `Wrapping up — chemistry around ${interest} feels strong enough to leave it to the humans.`;
  }
}

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

/** Persona-grounded template runner (Slice 2 stub). Keep for tests and MATCH_ENGINE_MODE=stub. */
export function createStubConversationRunner(): ConversationRunner {
  return {
    async runBotTurn(input: BotTurnInput): Promise<BotTurnResult> {
      const turn = input.history.length + 1;
      const phase = phaseForTurn(turn);
      const text = personaLine(input, phase, turn);
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
  if (options?.empty) {
    return createMidpointVenueSuggester({
      provider: createCatalogPlaceProvider([]),
      empty: true,
    });
  }
  return {
    async suggestVenue(input: SuggestVenueInput): Promise<SuggestVenueResult> {
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

export function dimsForTurn(turn: number, happyPath = false): ChemistryDims {
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
