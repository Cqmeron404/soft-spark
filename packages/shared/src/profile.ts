import type { PreferredAction } from "./types";

/** Edgar-locked v1 dating profile. Do not add product fields without a new lock. */
export const V1_PROFILE_FIELDS = [
  "botName",
  "bio",
  "likes",
  "dislikes",
  "hobbies",
  "height",
  "hairColor",
  "eyeColor",
  "city",
  "neighborhood",
  "lookingFor",
] as const;

export const BOT_NAME_MAX = 40;
export const SHORT_TEXT_MAX = 40;
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
  eyeColor: ["brown", "hazel", "blue", "green", "gray"],
} as const;

/** Hidden matching geo for v1 city/neighborhood (no Places). */
export const CITY_NEIGHBORHOODS = [
  { city: "Denver", neighborhood: "Capitol Hill", lat: 39.739, lng: -104.979 },
  { city: "Denver", neighborhood: "LoHi", lat: 39.759, lng: -104.999 },
  { city: "Denver", neighborhood: "RiNo", lat: 39.758, lng: -104.984 },
  { city: "Denver", neighborhood: "Highlands", lat: 39.762, lng: -105.011 },
  { city: "Denver", neighborhood: "Union Station", lat: 39.753, lng: -105.0 },
] as const;

export const DEFAULT_CITY = CITY_NEIGHBORHOODS[0];

export function geoForPlace(city?: string, neighborhood?: string) {
  const match = CITY_NEIGHBORHOODS.find(
    (row) =>
      row.city.toLowerCase() === (city ?? "").trim().toLowerCase() &&
      row.neighborhood.toLowerCase() === (neighborhood ?? "").trim().toLowerCase()
  );
  return match ?? DEFAULT_CITY;
}
