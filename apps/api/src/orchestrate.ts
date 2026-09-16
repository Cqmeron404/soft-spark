import {
  CONSTANTS,
  canEnterInviteReady,
  createStubConversationRunner,
  createStubMatchScorer,
  createStubSafetyGate,
  createStubVenueSuggester,
  dimsForTurn,
  earlyExitLowFit,
  passesHardFilter,
  profileFit,
  type MatchScorer,
  type ConversationRunner,
  type SafetyGate,
  type VenueSuggester,
} from "@soft-spark/match-engine";
import { EVENTS, isHomeCardReason } from "@soft-spark/shared";
import type { EventLog } from "./event-log.js";
import { snapshotFor } from "./snapshot.js";
import type { MatchRecord, MemoryStore } from "./store.js";
import { nextInviteWindow } from "./window.js";

export type Engine = {
  scorer: MatchScorer;
  runner: ConversationRunner;
  safety: SafetyGate;
  venues: VenueSuggester;
};

export function createEngine(
  store: MemoryStore,
  options?: { emptyVenues?: boolean }
): Engine {
  return {
    scorer: createStubMatchScorer(async (matchId) => {
      const match = store.matches.get(matchId);
      if (!match) throw new Error(`match ${matchId} not found`);
      return {
        a: snapshotFor(store, match.userAId),
        b: snapshotFor(store, match.userBId),
        chemistryDims: match.chemistryDims,
        safetyOk: match.safetyOk,
      };
    }),
    runner: createStubConversationRunner(),
    safety: createStubSafetyGate(),
    venues: createStubVenueSuggester({ empty: options?.emptyVenues }),
  };
}

export async function orchestrateMatch(input: {
  store: MemoryStore;
  events: EventLog;
  engine: Engine;
  userAId: string;
  userBId: string;
}): Promise<MatchRecord> {
  const { store, events, engine } = input;
  if (input.userAId === input.userBId) {
    throw Object.assign(new Error("cannot match a user with themselves"), {
      status: 400,
    });
  }
  const existing = store.existingPair(input.userAId, input.userBId);
  if (existing) return existing;

  const a = snapshotFor(store, input.userAId);
  const b = snapshotFor(store, input.userBId);
  if (!passesHardFilter(a, b)) {
    throw Object.assign(new Error("hard_filter_failed"), { status: 409 });
  }

  const match = store.createMatch({
    userAId: input.userAId,
    userBId: input.userBId,
    state: "exploring",
    confidence: 0,
    band: "low",
    reasons: [],
    safetyOk: true,
    profileFit: 0,
    chemistry: 0,
    logistics: 0,
    chemistryDims: dimsForTurn(0, true),
  });
  const convo = store.createConversation(match.id);
  const botA = store.botForUser(input.userAId);
  const botB = store.botForUser(input.userBId);
  if (!botA || !botB) throw new Error("dating bot missing");

  const started = Date.now();
  const maxMs = CONSTANTS.MAX_MINUTES * 60 * 1000;

  for (let turn = 1; turn <= CONSTANTS.MAX_TURNS; turn++) {
    if (Date.now() - started > maxMs) {
      events.emit(EVENTS.MATCH_ARCHIVED, {
        matchId: match.id,
        reason: "turn_budget_hit",
      });
      return store.updateMatch(match.id, { state: "archived" });
    }
    if (botA.paused && botB.paused) break;

    const aTurn = turn % 2 === 1;
    const bot = aTurn ? botA : botB;
    if (bot.paused) continue;

    events.emit(EVENTS.BOT_TURN_REQUESTED, { matchId: match.id, botId: bot.id });

    const history = store.messagesFor(convo.id).map((m) => ({
      role: m.role,
      text: m.text,
      at: m.createdAt,
    }));
    const result = await engine.runner.runBotTurn({
      matchId: match.id,
      botId: bot.id,
      userId: bot.userId,
      history,
      profile: aTurn ? a : b,
    });
    const gate = await engine.safety.checkMessage(result.text, { matchId: match.id });
    const safety = !result.safety.ok ? result.safety : gate;

    store.addMessage({
      conversationId: convo.id,
      role: aTurn ? "botA" : "botB",
      text: result.text,
      safetyOk: safety.ok,
    });
    events.emit(EVENTS.BOT_TURN_COMPLETED, {
      matchId: match.id,
      botId: bot.id,
      text: result.text,
      safety,
    });

    if (!safety.ok) {
      store.updateMatch(match.id, {
        state: "archived",
        safetyOk: false,
        confidence: 0,
        band: "low",
        reasons: [`safety_fail:${safety.code}`],
      });
      events.emit(EVENTS.MATCH_SAFETY_FAILED, {
        matchId: match.id,
        code: safety.code,
      });
      events.emit(EVENTS.MATCH_ARCHIVED, {
        matchId: match.id,
        reason: `safety_fail:${safety.code}`,
      });
      return store.matches.get(match.id)!;
    }

    store.updateMatch(match.id, { chemistryDims: dimsForTurn(turn, true) });
    const pf = profileFit(a, b).value;
    const chemistry =
      Object.values(store.matches.get(match.id)!.chemistryDims).reduce((s, n) => s + n, 0) / 5;
    if (earlyExitLowFit(turn, chemistry, pf)) {
      events.emit(EVENTS.MATCH_ARCHIVED, {
        matchId: match.id,
        reason: "low_fit_early_exit",
      });
      return store.updateMatch(match.id, {
        state: "archived",
        reasons: ["low_fit_early_exit"],
      });
    }
  }

  const scored = await engine.scorer.score(match.id);
  const homeReasons = scored.reasons.filter(isHomeCardReason).slice(0, 2);
  store.updateMatch(match.id, {
    confidence: scored.confidence,
    band: scored.band,
    reasons: homeReasons,
    safetyOk: scored.safetyOk,
    profileFit: scored.components.profileFit,
    chemistry: scored.components.chemistry,
    logistics: scored.components.logistics,
  });
  events.emit(EVENTS.MATCH_SCORE_UPDATED, {
    matchId: match.id,
    confidence: scored.confidence,
    band: scored.band,
    reasons: homeReasons,
  });

  const userA = store.users.get(input.userAId)!;
  const userB = store.users.get(input.userBId)!;
  const prefsA = store.prefsForUser(input.userAId);
  const prefsB = store.prefsForUser(input.userBId);

  if (scored.safetyOk && scored.confidence >= CONSTANTS.INVITE_THRESHOLD) {
    const suggested = await engine.venues.suggestVenue({
      userA: {
        homeGeo: { lat: userA.homeLat, lng: userA.homeLng },
        maxTravelKm: prefsA.maxTravelKm,
        cuisine: prefsA.cuisine,
        budget: prefsA.budget,
      },
      userB: {
        homeGeo: { lat: userB.homeLat, lng: userB.homeLng },
        maxTravelKm: prefsB.maxTravelKm,
        cuisine: prefsB.cuisine,
        budget: prefsB.budget,
      },
    });
    const gate = canEnterInviteReady(scored, suggested.candidates.length);
    if (!gate.ok && gate.emit === "match.venue_unavailable") {
      events.emit(EVENTS.MATCH_VENUE_UNAVAILABLE, {
        matchId: match.id,
        confidence: scored.confidence,
      });
      return store.updateMatch(match.id, { state: "exploring" });
    }
    if (gate.ok) {
      const pick = suggested.candidates[0];
      store.updateMatch(match.id, { state: "invite_ready" });
      events.emit(EVENTS.MATCH_INVITE_READY, {
        matchId: match.id,
        venueCandidates: suggested.candidates,
      });
      const venue = store.createVenue({
        name: pick.name,
        cuisine: pick.cuisine,
        priceTier: pick.priceTier,
        approxNeighborhood: pick.approxNeighborhood,
        lat: (userA.homeLat + userB.homeLat) / 2,
        lng: (userA.homeLng + userB.homeLng) / 2,
        source: "stub",
      });
      const window = nextInviteWindow(userA.homeTz || "America/Denver");
      const invite = store.createInvite({
        matchId: match.id,
        venueId: venue.id,
        windowStart: window.start,
        windowEnd: window.end,
        windowLabel: window.label,
        timeZone: window.timeZone,
        status: "pending",
        userAStatus: "waiting",
        userBStatus: "waiting",
        travelKmA: pick.travelKmA,
        travelKmB: pick.travelKmB,
        why: pick.why,
      });
      events.emit(EVENTS.INVITE_SENT, {
        matchId: match.id,
        inviteId: invite.id,
        venue: {
          name: venue.name,
          cuisine: venue.cuisine,
          priceTier: venue.priceTier,
          approxNeighborhood: venue.approxNeighborhood,
        },
        window,
      });
      return store.updateMatch(match.id, { state: "invited" });
    }
  }

  return store.matches.get(match.id)!;
}

export function respondInvite(input: {
  store: MemoryStore;
  events: EventLog;
  matchId: string;
  inviteId: string;
  userId: string;
  action: "accept" | "decline";
}): { match: MatchRecord } {
  const match = input.store.matches.get(input.matchId);
  const invite = input.store.invites.get(input.inviteId);
  if (!match || !invite || invite.matchId !== match.id) {
    throw Object.assign(new Error("not_found"), { status: 404 });
  }
  if (match.userAId !== input.userId && match.userBId !== input.userId) {
    throw Object.assign(new Error("forbidden"), { status: 403 });
  }
  const isA = match.userAId === input.userId;
  const mine = isA ? invite.userAStatus : invite.userBStatus;

  if (input.action === "accept") {
    if (match.state === "declined" || invite.status === "declined") {
      throw Object.assign(new Error("invite_closed"), { status: 409 });
    }
    if (mine === "accepted" && (match.state === "booked" || match.state === "invited")) {
      return { match };
    }
    const userAStatus = isA ? "accepted" : invite.userAStatus;
    const userBStatus = isA ? invite.userBStatus : "accepted";
    input.events.emit(EVENTS.INVITE_ACCEPTED, {
      matchId: match.id,
      userId: input.userId,
    });
    if (userAStatus === "accepted" && userBStatus === "accepted") {
      input.store.updateInvite(invite.id, {
        userAStatus,
        userBStatus,
        status: "booked",
      });
      input.events.emit(EVENTS.INVITE_BOOKED, {
        matchId: match.id,
        inviteId: invite.id,
      });
      return { match: input.store.updateMatch(match.id, { state: "booked" }) };
    }
    input.store.updateInvite(invite.id, { userAStatus, userBStatus });
    return { match: input.store.matches.get(match.id)! };
  }

  if (match.state === "declined" || invite.status === "declined") {
    return { match };
  }
  if (match.state === "booked") {
    throw Object.assign(new Error("already_booked"), { status: 409 });
  }
  const userAStatus = isA ? "declined" : invite.userAStatus;
  const userBStatus = isA ? invite.userBStatus : "declined";
  input.store.updateInvite(invite.id, {
    userAStatus,
    userBStatus,
    status: "declined",
  });
  input.events.emit(EVENTS.INVITE_DECLINED, {
    matchId: match.id,
    userId: input.userId,
  });
  return { match: input.store.updateMatch(match.id, { state: "declined" }) };
}
