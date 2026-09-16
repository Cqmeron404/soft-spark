import { haversineKm } from "./logic";
import type { UserProfileSnapshot } from "./types";

/**
 * Hard filters before bots talk:
 * mutual interested_in/gender, dealbreakers, maxTravelKm overlap possible.
 * Age band skipped unless optional min/max is present on either snapshot.
 */
export function passesHardFilter(
  a: UserProfileSnapshot,
  b: UserProfileSnapshot
): boolean {
  if (!mutualInterest(a, b)) return false;
  if (hitsDealbreaker(a.dealbreakers, b) || hitsDealbreaker(b.dealbreakers, a)) {
    return false;
  }
  const dist = haversineKm(a.homeGeo, b.homeGeo);
  if (dist > a.maxTravelKm + b.maxTravelKm) return false;
  return true;
}

function mutualInterest(a: UserProfileSnapshot, b: UserProfileSnapshot): boolean {
  return wants(a.interested_in, b.gender) && wants(b.interested_in, a.gender);
}

function wants(interestedIn: string[], gender: string): boolean {
  const set = interestedIn.map((s) => s.toLowerCase());
  const g = gender.toLowerCase();
  return set.includes("everyone") || set.includes("any") || set.includes(g);
}

function hitsDealbreaker(dealbreakers: string[], other: UserProfileSnapshot): boolean {
  const flags = new Set(
    [...other.interests, other.looking_for, other.gender].map((s) => s.toLowerCase())
  );
  return dealbreakers.some((d) => flags.has(d.toLowerCase()));
}
