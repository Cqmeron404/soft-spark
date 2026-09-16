/** Nexus snake_case reason codes → Aura SignalLine copy. */
export const SIGNAL_LINE_COPY: Record<string, string> = {
  intent_match: "Same dating goals",
  interest_overlap: "Shared interests popping up",
  vibe_overlap: "Energy feels compatible",
  high_reciprocity: "Back-and-forth is flowing",
  curiosity: "Digging deeper",
  value_alignment: "Talking values",
  shared_spark: "Real spark showing",
  logistics_ok: "Logistics lining up",
  travel_comfortable: "Meet-in-the-middle looks easy",
  intent_mismatch: "Different dating goals — still exploring",
  travel_tight: "Distance is tight",
  budget_gap: "Budget preferences differ",
  chemistry_building: "Chemistry still building",
  low_reciprocity: "Conversation uneven so far",
};

const HIDDEN_ON_HOME = new Set([
  "venue_unavailable",
  "low_fit_early_exit",
  "turn_budget_hit",
]);

export function isHomeCardReason(code: string): boolean {
  if (code.startsWith("safety_fail")) return false;
  if (HIDDEN_ON_HOME.has(code)) return false;
  return Boolean(SIGNAL_LINE_COPY[code]);
}

export function signalLinesFor(reasons: string[], max = 2): string[] {
  const out: string[] = [];
  for (const code of reasons) {
    if (!isHomeCardReason(code)) continue;
    const copy = SIGNAL_LINE_COPY[code];
    if (copy) out.push(copy);
    if (out.length >= max) break;
  }
  return out;
}
