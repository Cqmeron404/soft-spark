/**
 * Exact Nexus ↔ Forge contract types (forge-contract-v0).
 */
import type { ConfidenceBand } from "@soft-spark/shared";

export type { ConfidenceBand, MatchState } from "@soft-spark/shared";

export type Geo = { lat: number; lng: number };

export type ScoreResult = {
  matchId: string;
  confidence: number;
  band: ConfidenceBand;
  components: {
    profileFit: number;
    chemistry: number;
    logistics: number;
  };
  reasons: string[];
  safetyOk: boolean;
};

export type SafetyCode =
  | "harassment"
  | "illegal"
  | "underage"
  | "sexual_pressure"
  | "pii_dump";

export type SafetyResult = { ok: true } | { ok: false; code: SafetyCode };

export type UserProfileSnapshot = {
  displayName?: string;
  looking_for: "relationship" | "casual" | "unsure";
  age: number;
  gender: string;
  interested_in: string[];
  homeGeo: Geo;
  cuisine: string[];
  budget: 1 | 2 | 3 | 4;
  maxTravelKm: number;
  dealbreakers: string[];
  interests: string[];
  vibeTags: string[];
};

export type BotTurnInput = {
  matchId: string;
  botId: string;
  userId: string;
  history: Array<{ role: "botA" | "botB"; text: string; at: string }>;
  profile: UserProfileSnapshot;
};

export type BotTurnResult = {
  text: string;
  safety: SafetyResult;
  /** True when LLM path used stub/persona fallback. Internal only. */
  fallback?: boolean;
};

export type VenueCandidate = {
  name: string;
  cuisine: string;
  priceTier: 1 | 2 | 3 | 4;
  approxNeighborhood: string;
  travelKmA: number;
  travelKmB: number;
  why: string;
};

export type SuggestVenueInput = {
  userA: {
    homeGeo: Geo;
    maxTravelKm: number;
    cuisine: string[];
    budget: 1 | 2 | 3 | 4;
  };
  userB: {
    homeGeo: Geo;
    maxTravelKm: number;
    cuisine: string[];
    budget: 1 | 2 | 3 | 4;
  };
};

export type SuggestVenueResult = {
  candidates: VenueCandidate[];
};

export interface MatchScorer {
  score(matchId: string): Promise<ScoreResult>;
}

export interface ConversationRunner {
  runBotTurn(input: BotTurnInput): Promise<BotTurnResult>;
}

export interface SafetyGate {
  checkMessage(text: string, ctx?: { matchId?: string }): Promise<SafetyResult>;
  checkMatch(matchId: string): Promise<SafetyResult>;
}

export interface VenueSuggester {
  suggestVenue(input: SuggestVenueInput): Promise<SuggestVenueResult>;
}

export type ChemistryDims = {
  reciprocity: number;
  curiosity: number;
  valueAlignment: number;
  emotionalSafety: number;
  sharedSpark: number;
};

export type ScoreContext = {
  a: UserProfileSnapshot;
  b: UserProfileSnapshot;
  chemistryDims: ChemistryDims;
  safetyOk: boolean;
};

export type Place = {
  name: string;
  cuisine: string;
  priceTier: 1 | 2 | 3 | 4;
  geo: Geo;
  neighborhood: string;
};
