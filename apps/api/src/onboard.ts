import type { LookingFor, OnboardBody, PriceTier } from "@soft-spark/shared";
import type { SparkStore, UserRecord } from "./store.js";

export type OnboardResult = { user: UserRecord; created: boolean };

/** Persist dating profile + bot + prefs for an authenticated Better Auth id. */
export async function completeOnboard(
  store: SparkStore,
  input: { authId: string; email: string; body: OnboardBody }
): Promise<OnboardResult> {
  const { authId, email, body } = input;
  const profile = body.profile;
  const prefs = body.prefs;
  const existing = await store.userByAuthId(authId);
  const user = existing
    ? await store.updateUser(existing.id, {
        displayName: profile.displayName,
        age: profile.age,
        gender: profile.gender,
        interestedIn: profile.interestedIn ?? [],
        bio: profile.bio,
        photoUrl: body.photoUrl,
        homeLat: body.homeGeo.lat,
        homeLng: body.homeGeo.lng,
        homeTz: body.homeTz ?? "America/Denver",
      })
    : await store.createUser({
        authId,
        email,
        displayName: profile.displayName,
        age: profile.age,
        gender: profile.gender,
        interestedIn: profile.interestedIn ?? [],
        bio: profile.bio,
        photoUrl: body.photoUrl,
        homeLat: body.homeGeo.lat,
        homeLng: body.homeGeo.lng,
        homeTz: body.homeTz ?? "America/Denver",
        botDatingOptIn: true,
      });

  if (!(await store.botForUser(user.id))) {
    await store.createBot({
      userId: user.id,
      vibeTags: body.vibeTags ?? [],
      active: true,
      paused: false,
    });
  } else if (body.vibeTags) {
    await store.updateBot(user.id, { vibeTags: body.vibeTags });
  }

  try {
    await store.prefsForUser(user.id);
    await store.updatePrefs(user.id, {
      cuisine: [...prefs.cuisine],
      budget: prefs.budget as PriceTier,
      maxTravelKm: prefs.maxTravelKm,
      dealbreakers: [...(prefs.dealbreakers ?? [])],
      lookingFor: (prefs.lookingFor as LookingFor | undefined) ?? "unsure",
      interests: [...(prefs.interests ?? [])],
    });
  } catch {
    await store.createPrefs({
      userId: user.id,
      cuisine: [...prefs.cuisine],
      budget: prefs.budget as PriceTier,
      maxTravelKm: prefs.maxTravelKm,
      dealbreakers: [...(prefs.dealbreakers ?? [])],
      lookingFor: (prefs.lookingFor as LookingFor | undefined) ?? "unsure",
      interests: [...(prefs.interests ?? [])],
    });
  }

  return { user, created: !existing };
}
