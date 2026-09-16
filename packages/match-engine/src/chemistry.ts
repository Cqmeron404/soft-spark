import type { ChemistryDims, UserProfileSnapshot } from "./types";

export type TranscriptTurn = { role: "botA" | "botB"; text: string; at: string };

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function intentFit(
  a: UserProfileSnapshot["looking_for"] | undefined,
  b: UserProfileSnapshot["looking_for"] | undefined
): number {
  if (!a || !b) return 0.55;
  if (a === b) return 1;
  if (a === "unsure" || b === "unsure") return 0.7;
  return 0.35;
}

function tokenSet(texts: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of texts) {
    for (const w of t.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length > 2) out.add(w);
    }
  }
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / Math.max(a.size, b.size);
}

/**
 * Option B (Nexus Slice 2): heuristic chemistry from transcript.
 * Overlapping Denver profiles with persona-grounded turns clear ~0.65+ chemistry
 * so invite_threshold can still be reached without HAPPY_PATH_DIMS.
 */
export function heuristicChemistryFromTranscript(
  history: TranscriptTurn[],
  snapshots?: { a: UserProfileSnapshot; b: UserProfileSnapshot }
): ChemistryDims {
  const aTurns = history.filter((h) => h.role === "botA");
  const bTurns = history.filter((h) => h.role === "botB");
  const total = Math.max(history.length, 1);
  const balance =
    aTurns.length === 0 || bTurns.length === 0
      ? 0.45
      : Math.min(aTurns.length, bTurns.length) / Math.max(aTurns.length, bTurns.length);
  const questions = history.filter((h) => h.text.includes("?")).length;
  const curiosity = clamp01(0.4 + 0.5 * (questions / total) + (history.length >= 6 ? 0.1 : 0));
  const allText = history.map((h) => h.text).join(" ");
  const pressure = /\b(send nudes|you owe me|don't say no|must meet)\b/i.test(allText);
  const emotionalSafety = pressure ? 0.2 : 0.82;
  const profileInterests = [
    ...(snapshots?.a.interests ?? []),
    ...(snapshots?.b.interests ?? []),
  ];
  const spoken = tokenSet(history.map((h) => h.text));
  const interestTokens = tokenSet(profileInterests);
  const transcriptSpark = overlap(spoken, interestTokens);
  const profileSpark = overlap(
    tokenSet(snapshots?.a.interests ?? []),
    tokenSet(snapshots?.b.interests ?? [])
  );
  const sharedSpark = clamp01(0.35 + 0.4 * Math.max(transcriptSpark, profileSpark) + (history.length >= 8 ? 0.15 : 0.08));
  const valueAlignment = clamp01(
    0.2 + 0.8 * intentFit(snapshots?.a.looking_for, snapshots?.b.looking_for)
  );
  const reciprocity = clamp01(0.35 + 0.6 * balance + (history.length >= 4 ? 0.05 : 0));
  return {
    reciprocity,
    curiosity,
    valueAlignment,
    emotionalSafety,
    sharedSpark,
  };
}

export async function chemistryFromTranscript(
  history: TranscriptTurn[],
  options?: {
    snapshots?: { a: UserProfileSnapshot; b: UserProfileSnapshot };
    judge?: (history: TranscriptTurn[]) => Promise<ChemistryDims | null>;
  }
): Promise<ChemistryDims> {
  if (options?.judge) {
    try {
      const judged = await options.judge(history);
      if (judged) return judged;
    } catch {
      /* fall through to heuristic */
    }
  }
  return heuristicChemistryFromTranscript(history, options?.snapshots);
}
