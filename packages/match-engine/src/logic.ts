/**
 * Nexus reference logic v0 — drop-in behind Forge stubs.
 * Frozen contract: dating-app/nexus/forge-contract-v0.md
 * Reasons: dating-app/nexus/reasons-v0.md
 */

import type {
  ChemistryDims,
  ConfidenceBand,
  Geo,
  SafetyCode,
  SafetyResult,
  ScoreResult,
  UserProfileSnapshot,
  VenueCandidate,
} from "./types";

const INVITE_THRESHOLD = 0.75;
const W_PROFILE = 0.35;
const W_CHEM = 0.45;
const W_LOG = 0.20;

const SAFETY_PATTERNS: Array<{ code: SafetyCode; re: RegExp }> = [
  { code: "underage", re: /\b(under\s*age|young\s*teen|\b1[0-7]\s*years?\s*old)\b/i },
  { code: "illegal", re: /\b(drugs? deal|buy\s+cocaine|kill\s+you)\b/i },
  { code: "harassment", re: /\b(stupid\s+bitch|kill\s+yourself|worthless\s+slut)\b/i },
  { code: "sexual_pressure", re: /\b(send\s+nudes|you\s+owe\s+me\s+sex|don'?t\s+say\s+no)\b/i },
  { code: "pii_dump", re: /\b(\d{3}[-.]?\d{3}[-.]?\d{4}|my\s+address\s+is\s+\d+)\b/i },
];

export function bandFor(confidence: number): ConfidenceBand {
  if (confidence >= 0.75) return "invite_ready";
  if (confidence >= 0.6) return "strong";
  if (confidence >= 0.4) return "building";
  return "low";
}

export function safetyCheckMessage(text: string): SafetyResult {
  for (const { code, re } of SAFETY_PATTERNS) {
    if (re.test(text)) return { ok: false, code };
  }
  return { ok: true };
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a.map((s) => s.toLowerCase()));
  const B = new Set(b.map((s) => s.toLowerCase()));
  if (A.size === 0 && B.size === 0) return 0.5;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0.5 : inter / union;
}

function intentFit(
  a: UserProfileSnapshot["looking_for"],
  b: UserProfileSnapshot["looking_for"]
): number {
  if (a === b) return 1;
  if (a === "unsure" || b === "unsure") return 0.7;
  return 0.35;
}

export function profileFit(
  a: UserProfileSnapshot,
  b: UserProfileSnapshot
): { value: number; reasons: string[] } {
  const reasons: string[] = [];
  const intent = intentFit(a.looking_for, b.looking_for);
  if (intent >= 0.9) reasons.push("intent_match");
  else if (intent <= 0.4) reasons.push("intent_mismatch");

  const interests = jaccard(a.interests, b.interests);
  if (interests >= 0.3) reasons.push("interest_overlap");

  const vibe = jaccard(a.vibeTags, b.vibeTags);
  if (vibe >= 0.3) reasons.push("vibe_overlap");

  const value = clamp01(0.45 * intent + 0.35 * interests + 0.2 * vibe);
  return { value, reasons };
}

export function chemistryFromDims(dims: ChemistryDims): {
  value: number;
  reasons: string[];
} {
  const value =
    (dims.reciprocity +
      dims.curiosity +
      dims.valueAlignment +
      dims.emotionalSafety +
      dims.sharedSpark) /
    5;
  const reasons: string[] = [];
  if (dims.reciprocity >= 0.7) reasons.push("high_reciprocity");
  else if (dims.reciprocity < 0.4) reasons.push("low_reciprocity");
  if (dims.curiosity >= 0.65) reasons.push("curiosity");
  if (dims.valueAlignment >= 0.65) reasons.push("value_alignment");
  if (dims.sharedSpark >= 0.65) reasons.push("shared_spark");
  if (value < 0.5 && value >= 0.35) reasons.push("chemistry_building");
  return { value: clamp01(value), reasons };
}

/** Haversine km */
export function haversineKm(a: Geo, b: Geo): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function midpoint(a: Geo, b: Geo): Geo {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export function logisticsFit(
  a: UserProfileSnapshot,
  b: UserProfileSnapshot
): { value: number; reasons: string[]; mid: Geo; kmA: number; kmB: number } {
  const mid = midpoint(a.homeGeo, b.homeGeo);
  const kmA = haversineKm(a.homeGeo, mid);
  const kmB = haversineKm(b.homeGeo, mid);
  const okA = kmA <= a.maxTravelKm;
  const okB = kmB <= b.maxTravelKm;
  const reasons: string[] = [];
  if (!okA || !okB) {
    reasons.push("travel_tight");
    return { value: 0.15, reasons, mid, kmA, kmB };
  }
  const headroom =
    (Math.max(0, a.maxTravelKm - kmA) / Math.max(a.maxTravelKm, 1) +
      Math.max(0, b.maxTravelKm - kmB) / Math.max(b.maxTravelKm, 1)) /
    2;
  const value = clamp01(0.55 + 0.45 * headroom);
  if (value >= 0.7) reasons.push("logistics_ok");
  if (headroom >= 0.4) reasons.push("travel_comfortable");
  else if (headroom < 0.15) reasons.push("travel_tight");
  return { value, reasons, mid, kmA, kmB };
}

export function scoreMatch(input: {
  matchId: string;
  a: UserProfileSnapshot;
  b: UserProfileSnapshot;
  chemistryDims: ChemistryDims;
  safetyOk: boolean;
}): ScoreResult {
  if (!input.safetyOk) {
    return {
      matchId: input.matchId,
      confidence: 0,
      band: "low",
      components: { profileFit: 0, chemistry: 0, logistics: 0 },
      reasons: [],
      safetyOk: false,
    };
  }
  const pf = profileFit(input.a, input.b);
  const ch = chemistryFromDims(input.chemistryDims);
  const lg = logisticsFit(input.a, input.b);
  const confidence = clamp01(
    W_PROFILE * pf.value + W_CHEM * ch.value + W_LOG * lg.value
  );
  const reasons = pickReasons([...pf.reasons, ...ch.reasons, ...lg.reasons], 2);
  return {
    matchId: input.matchId,
    confidence,
    band: bandFor(confidence),
    components: {
      profileFit: pf.value,
      chemistry: ch.value,
      logistics: lg.value,
    },
    reasons,
    safetyOk: true,
  };
}

/** Guard: exploring → invite_ready only if confidence ≥ 0.75 AND safety AND ≥1 venue */
export function canEnterInviteReady(
  score: ScoreResult,
  venueCount: number
): { ok: true } | { ok: false; emit?: "match.venue_unavailable" } {
  if (!score.safetyOk || score.confidence < INVITE_THRESHOLD) return { ok: false };
  if (venueCount < 1) return { ok: false, emit: "match.venue_unavailable" };
  return { ok: true };
}

export function earlyExitLowFit(
  turnIndex: number,
  chemistry: number,
  profileFitValue: number
): boolean {
  return turnIndex >= 4 && chemistry < 0.35 && profileFitValue < 0.4;
}

/** Provider-agnostic filter/rank. Forge supplies raw places near mid. */
export function suggestVenue(input: {
  a: UserProfileSnapshot;
  b: UserProfileSnapshot;
  places: Array<{
    name: string;
    cuisine: string;
    priceTier: 1 | 2 | 3 | 4;
    geo: Geo;
    neighborhood: string;
  }>;
}): VenueCandidate[] {
  const mid = midpoint(input.a.homeGeo, input.b.homeGeo);
  const cuisineIntersect = new Set(
    input.a.cuisine
      .map((c) => c.toLowerCase())
      .filter((c) =>
        input.b.cuisine.map((x) => x.toLowerCase()).includes(c)
      )
  );
  const maxBudget = Math.min(input.a.budget, input.b.budget) as 1 | 2 | 3 | 4;

  const scored = input.places
    .map((p) => {
      const travelKmA = haversineKm(input.a.homeGeo, p.geo);
      const travelKmB = haversineKm(input.b.homeGeo, p.geo);
      if (travelKmA > input.a.maxTravelKm || travelKmB > input.b.maxTravelKm) {
        return null;
      }
      if (p.priceTier > maxBudget) return null;
      const cuisineHit = cuisineIntersect.has(p.cuisine.toLowerCase());
      const midDist = haversineKm(mid, p.geo);
      const rank =
        (cuisineHit ? 2 : 0) +
        (1 - Math.min(midDist, 10) / 10) +
        (1 - Math.abs(travelKmA - travelKmB) / 10);
      return {
        candidate: {
          name: p.name,
          cuisine: p.cuisine,
          priceTier: p.priceTier,
          approxNeighborhood: p.neighborhood,
          travelKmA: round1(travelKmA),
          travelKmB: round1(travelKmB),
          why: cuisineHit
            ? "Matches shared cuisine near the midpoint"
            : "Feasible midpoint pick within both travel budgets",
        } satisfies VenueCandidate,
        rank,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((x, y) => y.rank - x.rank);

  return scored.slice(0, 3).map((s) => s.candidate);
}

/** Bot phase by turn index (1-based total turns in match) */
export function phaseForTurn(
  turn: number
): "open" | "explore" | "spark" | "close" {
  if (turn <= 2) return "open";
  if (turn <= 6) return "explore";
  if (turn <= 8) return "spark";
  return "close";
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function pickReasons(codes: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

export const CONSTANTS = {
  INVITE_THRESHOLD,
  W_PROFILE,
  W_CHEM,
  W_LOG,
  MAX_TURNS: 10,
  MAX_MINUTES: 12,
  INVITE_WINDOW: {
    days: ["Fri", "Sat", "Sun"] as const,
    localStart: "18:00",
    localEnd: "20:00",
  },
};
