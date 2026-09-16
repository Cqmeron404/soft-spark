/**
 * Nexus match-logic-v0 surface for Slice 2 drop-ins.
 * Scoring helpers already live in ./logic (same algorithms as nexus/ref/match-logic-v0.ts).
 */
export {
  bandFor,
  canEnterInviteReady,
  chemistryFromDims,
  CONSTANTS,
  earlyExitLowFit,
  haversineKm,
  logisticsFit,
  midpoint,
  phaseForTurn,
  profileFit,
  safetyCheckMessage,
  scoreMatch,
  suggestVenue,
} from "./logic";
export type {
  ChemistryDims,
  ConfidenceBand,
  Geo,
  SafetyCode,
  SafetyResult,
  ScoreResult,
  UserProfileSnapshot,
  VenueCandidate,
} from "./types";
