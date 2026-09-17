import type { BotDto, MatchDetail, MatchListItem, UserDto } from "@soft-spark/shared";
import {
  isHomeCardReason,
  kmToMiles,
  lookingForGenderFromInterestedIn,
  normalizeGender,
  normalizeIntent,
  roamStatusFor,
} from "@soft-spark/shared";
import type { SparkStore } from "./store.js";

export async function toUserDto(store: SparkStore, userId: string): Promise<UserDto> {
  const user = await store.getUser(userId);
  const prefs = await store.prefsForUser(userId);
  if (!user) throw new Error("user not found");
  return {
    id: user.id,
    displayName: user.displayName,
    age: user.age,
    gender: normalizeGender(user.gender) ?? user.gender,
    lookingForGender:
      prefs.lookingForGender ??
      lookingForGenderFromInterestedIn(user.interestedIn),
    interestedIn: user.interestedIn,
    bio: user.bio,
    photoUrl: user.photoUrl,
    height: user.height,
    hairColor: user.hairColor,
    eyeColor: user.eyeColor,
    city: user.city,
    neighborhood: user.neighborhood,
    likes: user.likes ?? [],
    dislikes: user.dislikes ?? [],
    hobbies: user.hobbies.length ? user.hobbies : prefs.interests ?? [],
    botDatingOptIn: user.botDatingOptIn,
    homeGeo: { lat: user.homeLat, lng: user.homeLng },
    homeTz: user.homeTz,
    prefs: {
      cuisine: prefs.cuisine,
      budget: prefs.budget,
      maxTravelKm: prefs.maxTravelKm,
      maxTravelMiles: kmToMiles(prefs.maxTravelKm),
      dealbreakers: prefs.dealbreakers,
      intent: normalizeIntent(prefs.lookingFor),
      lookingFor: prefs.lookingFor,
      lookingForGender:
        prefs.lookingForGender ?? lookingForGenderFromInterestedIn(user.interestedIn),
      interests: prefs.interests,
    },
  };
}

export async function toBotDto(store: SparkStore, userId: string): Promise<BotDto> {
  const bot = await store.botForUser(userId);
  if (!bot) throw new Error("bot not found");
  return {
    id: bot.id,
    vibeTags: bot.vibeTags,
    styleTags: bot.vibeTags,
    active: bot.active,
    paused: bot.paused,
    displayName: bot.displayName,
    publishedAt: bot.publishedAt,
    preferredAction: bot.preferredAction,
    roamStatus: bot.roamStatus ?? roamStatusFor(bot),
  };
}

export async function toMatchListItem(
  store: SparkStore,
  matchId: string,
  viewerId: string
): Promise<MatchListItem> {
  const match = await store.getMatch(matchId);
  if (!match) throw new Error("match not found");
  const peerId = match.userAId === viewerId ? match.userBId : match.userAId;
  const peer = await store.getUser(peerId);
  return {
    id: match.id,
    state: match.state,
    band: match.band,
    updatedAt: match.updatedAt,
    peer: peer ? { displayName: peer.displayName, photoUrl: peer.photoUrl } : undefined,
    reasons: match.reasons.filter(isHomeCardReason).slice(0, 2),
  };
}

export async function toMatchDetail(
  store: SparkStore,
  matchId: string,
  viewerId: string
): Promise<MatchDetail> {
  const base = await toMatchListItem(store, matchId, viewerId);
  const match = (await store.getMatch(matchId))!;
  const invite = await store.inviteForMatch(matchId);
  if (!invite) return base;
  const venue = await store.getVenue(invite.venueId);
  if (!venue) return base;
  const isA = match.userAId === viewerId;
  return {
    ...base,
    invite: {
      id: invite.id,
      status: invite.status,
      venue: {
        name: venue.name,
        cuisine: venue.cuisine,
        priceTier: venue.priceTier,
        approxNeighborhood: venue.approxNeighborhood,
        travelKmYou: isA ? invite.travelKmA : invite.travelKmB,
        travelKmThem: isA ? invite.travelKmB : invite.travelKmA,
        why: invite.why,
      },
      window: {
        start: invite.windowStart,
        end: invite.windowEnd,
        label: invite.windowLabel,
        timeZone: invite.timeZone,
      },
      you: isA ? invite.userAStatus : invite.userBStatus,
      them: isA ? invite.userBStatus : invite.userAStatus,
      youCarryCue: isA ? invite.carryCueA : invite.carryCueB,
      themCarryCue: isA ? invite.carryCueB : invite.carryCueA,
    },
  };
}

/** Strip any internal-only keys if a record is spread by mistake. */
export function assertClientSafe(payload: unknown): void {
  const json = JSON.stringify(payload);
  if (json.includes('"confidence"') || json.includes("transcript")) {
    throw new Error("client payload leaked confidence or transcript");
  }
  if (/"messages"\s*:/.test(json)) {
    throw new Error("client payload leaked messages[]");
  }
}
