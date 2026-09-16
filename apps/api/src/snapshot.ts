import type { UserProfileSnapshot } from "@soft-spark/match-engine";
import type { MemoryStore, PreferenceRecord, UserRecord } from "./store.js";

export function snapshotFor(
  store: MemoryStore,
  userId: string
): UserProfileSnapshot {
  const user = store.users.get(userId);
  const prefs = store.prefsForUser(userId);
  const bot = store.botForUser(userId);
  if (!user || !bot) throw new Error(`incomplete profile ${userId}`);
  return toSnapshot(user, prefs, bot.vibeTags);
}

export function toSnapshot(
  user: UserRecord,
  prefs: PreferenceRecord,
  vibeTags: string[]
): UserProfileSnapshot {
  return {
    looking_for: prefs.lookingFor,
    age: user.age,
    gender: user.gender,
    interested_in: user.interestedIn,
    homeGeo: { lat: user.homeLat, lng: user.homeLng },
    cuisine: prefs.cuisine,
    budget: prefs.budget,
    maxTravelKm: prefs.maxTravelKm,
    dealbreakers: prefs.dealbreakers,
    interests: prefs.interests,
    vibeTags,
  };
}
