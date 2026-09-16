import type { UserProfileSnapshot } from "@soft-spark/match-engine";
import type { PreferenceRecord, SparkStore, UserRecord } from "./store.js";

export async function snapshotFor(
  store: SparkStore,
  userId: string
): Promise<UserProfileSnapshot> {
  const user = await store.getUser(userId);
  const prefs = await store.prefsForUser(userId);
  const bot = await store.botForUser(userId);
  if (!user || !bot) throw new Error(`incomplete profile ${userId}`);
  return toSnapshot(user, prefs, bot.vibeTags);
}

export function toSnapshot(
  user: UserRecord,
  prefs: PreferenceRecord,
  vibeTags: string[]
): UserProfileSnapshot {
  return {
    displayName: user.displayName,
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
