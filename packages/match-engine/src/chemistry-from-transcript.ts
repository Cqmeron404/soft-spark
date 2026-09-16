/**
 * Heuristic chemistry dims from bot↔bot transcript (Slice 2 option B).
 * Use when MATCH_ENGINE_MODE=llm for turns but judge is offline, or as fallback.
 * Dims feed scoreMatch / chemistryFromDims — never expose transcript to clients.
 */
import type { ChemistryDims } from "./match-logic-v0";

export type TranscriptMsg = { role: "botA" | "botB"; text: string };

const INTEREST_HINTS = [
  "food", "hike", "hiking", "music", "art", "travel", "coffee", "pasta",
  "italian", "design", "book", "run", "gym", "dog", "cat", "film", "movie",
];

export function chemistryFromTranscript(history: TranscriptMsg[]): ChemistryDims {
  if (history.length === 0) {
    return {
      reciprocity: 0.4,
      curiosity: 0.4,
      valueAlignment: 0.45,
      emotionalSafety: 0.7,
      sharedSpark: 0.35,
    };
  }

  const a = history.filter((m) => m.role === "botA");
  const b = history.filter((m) => m.role === "botB");
  const total = history.length;
  const balance = 1 - Math.abs(a.length - b.length) / Math.max(total, 1);
  const reciprocity = clamp01(0.35 + 0.65 * balance);

  const questions = history.filter((m) => m.text.includes("?")).length;
  const curiosity = clamp01(0.3 + 0.7 * Math.min(1, questions / Math.max(total * 0.4, 1)));

  const joined = history.map((m) => m.text.toLowerCase()).join(" ");
  const valueHits = ["value", "evening", "weekend", "pace", "looking for", "relationship", "casual"]
    .filter((k) => joined.includes(k)).length;
  const valueAlignment = clamp01(0.4 + 0.1 * valueHits);

  const pressure = /\b(send nudes|owe me|don't say no|stupid|kill yourself)\b/i.test(joined);
  const emotionalSafety = pressure ? 0.15 : clamp01(0.75 + 0.05 * Math.min(questions, 3));

  const interestHits = INTEREST_HINTS.filter((k) => joined.includes(k)).length;
  const sharedSpark = clamp01(0.25 + 0.08 * interestHits + (questions >= 2 ? 0.1 : 0));

  return {
    reciprocity,
    curiosity,
    valueAlignment,
    emotionalSafety,
    sharedSpark,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
