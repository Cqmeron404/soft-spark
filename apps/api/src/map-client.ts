import type { BotDto, MatchDetail, MatchListItem, UserDto } from "@soft-spark/shared";
import { isHomeCardReason } from "@soft-spark/shared";
import type { MemoryStore } from "./store.js";

export function toUserDto(store: MemoryStore, userId: string): UserDto {
  const user = store.users.get(userId);
  const prefs = store.prefsForUser(userId);
  if (!user) throw new Error("user not found");
  return {
    id: user.id,
    displayName: user.displayName,
    age: user.age,
    gender: user.gender,
    interestedIn: user.interestedIn,
    bio: user.bio,
    homeGeo: { lat: user.homeLat, lng: user.homeLng },
    homeTz: user.homeTz,
    prefs: {
      cuisine: prefs.cuisine,
      budget: prefs.budget,
      maxTravelKm: prefs.maxTravelKm,
      dealbreakers: prefs.dealbreakers,
      lookingFor: prefs.lookingFor,
      interests: prefs.interests,
    },
  };
}

export function toBotDto(store: MemoryStore, userId: string): BotDto {
  const bot = store.botForUser(userId);
  if (!bot) throw new Error("bot not found");
  return {
    id: bot.id,
    vibeTags: bot.vibeTags,
    active: bot.active,
    paused: bot.paused,
  };
}

export function toMatchListItem(
  store: MemoryStore,
  matchId: string,
  viewerId: string
): MatchListItem {
  const match = store.matches.get(matchId);
  if (!match) throw new Error("match not found");
  const peerId = match.userAId === viewerId ? match.userBId : match.userAId;
  const peer = store.users.get(peerId);
  return {
    id: match.id,
    state: match.state,
    band: match.band,
    updatedAt: match.updatedAt,
    peer: peer ? { displayName: peer.displayName } : undefined,
    reasons: match.reasons.filter(isHomeCardReason).slice(0, 2),
  };
}

export function toMatchDetail(
  store: MemoryStore,
  matchId: string,
  viewerId: string
): MatchDetail {
  const base = toMatchListItem(store, matchId, viewerId);
  const match = store.matches.get(matchId)!;
  const invite = store.inviteForMatch(matchId);
  if (!invite) return base;
  const venue = store.venues.get(invite.venueId);
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
    },
  };
}

/** Strip any internal-only keys if a record is spread by mistake. */
export function assertClientSafe(payload: unknown): void {
  const json = JSON.stringify(payload);
  if (json.includes('"confidence"') || json.includes("transcript")) {
    throw new Error("client payload leaked confidence or transcript");
  }
}
