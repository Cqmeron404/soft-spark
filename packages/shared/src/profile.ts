import type { PreferredAction } from "./types";

export const BOT_NAME_MAX = 40;
export const SHORT_TEXT_MAX = 40;
export const JOB_TEXT_MAX = 80;
export const BIO_MAX = 280;
export const TAG_MAX = 12;
export const TAG_LEN = 32;

/** Trim / cap / de-dupe dating-profile chip lists (likes, dislikes, hobbies). */
export function normalizeTagList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const clipped = item.replace(/\s+/g, " ").trim().slice(0, TAG_LEN);
    if (!clipped) continue;
    const key = clipped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clipped);
    if (out.length >= TAG_MAX) break;
  }
  return out;
}

export function normalizeShortText(raw: unknown, max = SHORT_TEXT_MAX): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

export function normalizePreferredAction(raw: unknown): PreferredAction {
  return raw === "roam" ? "roam" : "wait";
}

export const PROFILE_CHIP_PRESETS = {
  likes: ["pasta", "live music", "late walks", "coffee", "dogs", "travel", "cooking", "movies"],
  dislikes: ["cigarettes", "ghosting", "tardiness", "loud bars"],
  hobbies: ["hiking", "food", "design", "live music", "running", "reading", "climbing"],
  hairColor: ["black", "brown", "dark brown", "blonde", "red", "auburn", "gray"],
} as const;
