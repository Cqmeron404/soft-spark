import {
  CONSTANTS,
  canEnterInviteReady,
  chemistryFromTranscript,
  createCatalogPlaceProvider,
  createGooglePlaceProvider,
  createLlmChemistryJudge,
  createLlmConversationRunner,
  createMidpointVenueSuggester,
  createStubConversationRunner,
  createStubMatchScorer,
  createStubSafetyGate,
  DENVER_PLACES,
  earlyExitLowFit,
  llmConfigured,
  passesHardFilter,
  profileFit,
  resolveMatchEngineMode,
  resolveVenueMode,
  type MatchScorer,
  type ConversationRunner,
  type SafetyGate,
  type VenueSuggester,
  type ChemistryDims,
} from "@soft-spark/match-engine";
import {
  BOT_SEARCH_ETA,
  EVENTS,
  isClientPushType,
  isHomeCardReason,
  normalizeCarryCue,
  type ClientRealtimeEvent,
  type MatchState,
} from "@soft-spark/shared";
import type { EventLog } from "./event-log.js";
import { assertPlacesInProd } from "./env.js";
import type { PushDispatcher } from "./push.js";
import type { RealtimeHub } from "./realtime.js";
import { snapshotFor } from "./snapshot.js";
import type { MatchRecord, SparkStore } from "./store.js";
import { nextInviteWindow } from "./window.js";

export type Engine = {
  scorer: MatchScorer;
  runner: ConversationRunner;
  safety: SafetyGate;
  venues: VenueSuggester;
  /** Soak/test hook: override transcript dims (live path uses chemistryFromTranscript). */
  chemistryFromHistory?: (
    history: Array<{ role: string; text: string }>
  ) => ChemistryDims | Promise<ChemistryDims>;
};

export async function createEngine(
  store: SparkStore,
  options?: { emptyVenues?: boolean }
): Promise<Engine> {
  const stubRunner = createStubConversationRunner();
  const resolved = resolveMatchEngineMode({
    MATCH_ENGINE_MODE: process.env.MATCH_ENGINE_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  });
  if (resolved.log) console.warn(`[match-engine] ${resolved.log}`);
  const runner = resolved.usedLlm
    ? createLlmConversationRunner(
        {
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: process.env.OPENAI_BASE_URL,
          model: process.env.OPENAI_MODEL,
        },
        stubRunner
      )
    : stubRunner;
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  assertPlacesInProd(process.env, { emptyVenues: options?.emptyVenues });
  const venueMode = resolveVenueMode(process.env);
  const usePlaces = venueMode === "places" && Boolean(googleKey) && !options?.emptyVenues;
  const catalog = usePlaces ? [] : await store.listCatalog();
  const provider = usePlaces
    ? createGooglePlaceProvider({ apiKey: googleKey as string })
    : createCatalogPlaceProvider(catalog.length ? catalog : DENVER_PLACES);
  return {
    scorer: createStubMatchScorer(async (matchId) => {
      const match = await store.getMatch(matchId);
      if (!match) throw new Error(`match ${matchId} not found`);
      return {
        a: await snapshotFor(store, match.userAId),
        b: await snapshotFor(store, match.userBId),
        chemistryDims: match.chemistryDims,
        safetyOk: match.safetyOk,
      };
    }),
    runner,
    safety: createStubSafetyGate(),
    venues: createMidpointVenueSuggester({
      provider: options?.emptyVenues ? createCatalogPlaceProvider([]) : provider,
      empty: options?.emptyVenues,
    }),
  };
}

async function publishClient(
  store: SparkStore,
  hub: RealtimeHub | undefined,
  type: ClientRealtimeEvent["type"],
  matchId: string,
  push?: PushDispatcher
) {
  if (!hub) return;
  const match = await store.getMatch(matchId);
  if (!match) return;
  const invite = await store.inviteForMatch(matchId);
  const event: ClientRealtimeEvent = {
    type,
    matchId,
    state: match.state,
    band: match.band,
    reasons: match.reasons.filter(isHomeCardReason).slice(0, 2),
    invite: invite
      ? {
          id: invite.id,
          status: invite.status,
          userAStatus: invite.userAStatus,
          userBStatus: invite.userBStatus,
        }
      : undefined,
  };
  await hub.publish([match.userAId, match.userBId], event);
  if (push && isClientPushType(type)) {
    await push.notify([match.userAId, match.userBId], event);
  }
}

export async function orchestrateMatch(input: {
  store: SparkStore;
  events: EventLog;
  engine: Engine;
  userAId: string;
  userBId: string;
  hub?: RealtimeHub;
  push?: PushDispatcher;
}): Promise<MatchRecord> {
  const { store, events, engine, hub, push } = input;
  if (input.userAId === input.userBId) {
    throw Object.assign(new Error("cannot match a user with themselves"), {
      status: 400,
    });
  }
  const existing = await store.existingPair(input.userAId, input.userBId);
  if (existing) return existing;

  const a = await snapshotFor(store, input.userAId);
  const b = await snapshotFor(store, input.userBId);
  if (!passesHardFilter(a, b)) {
    throw Object.assign(new Error("hard_filter_failed"), { status: 409 });
  }

  let match = await store.createMatch({
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
    chemistryDims: chemistryFromTranscript([]),
  });
  const convo = await store.createConversation(match.id);
  const botA = await store.botForUser(input.userAId);
  const botB = await store.botForUser(input.userBId);
  if (!botA || !botB) throw new Error("dating bot missing");

  const started = Date.now();
  const maxMs = CONSTANTS.MAX_MINUTES * 60 * 1000;
  const judge = llmConfigured({
    MATCH_ENGINE_MODE: process.env.MATCH_ENGINE_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  })
    ? createLlmChemistryJudge({
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL,
      })
    : undefined;

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

    const history = (await store.messagesFor(convo.id)).map((m) => ({
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

    await store.addMessage({
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
    if (result.fallback) {
      events.emit(EVENTS.BOT_TURN_FALLBACK, { matchId: match.id, botId: bot.id });
    }

    if (!safety.ok) {
      await store.updateMatch(match.id, {
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
      return (await store.getMatch(match.id))!;
    }

    const transcript = (await store.messagesFor(convo.id)).map((m) => ({
      role: m.role,
      text: m.text,
    }));
    const heuristic = chemistryFromTranscript(transcript);
    const dims = engine.chemistryFromHistory
      ? await engine.chemistryFromHistory(transcript)
      : judge
        ? await judge(transcript, heuristic)
        : heuristic;
    match = await store.updateMatch(match.id, { chemistryDims: dims });
    const pf = profileFit(a, b).value;
    const chemistry =
      Object.values(match.chemistryDims).reduce((s, n) => s + n, 0) / 5;
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
  match = await store.updateMatch(match.id, {
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
  await publishClient(store, hub, "match.score.updated", match.id, push);

  const userA = await store.getUser(input.userAId);
  const userB = await store.getUser(input.userBId);
  const prefsA = await store.prefsForUser(input.userAId);
  const prefsB = await store.prefsForUser(input.userBId);
  if (!userA || !userB) throw new Error("user missing");

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
      match = await store.updateMatch(match.id, { state: "exploring" });
      await publishClient(store, hub, "match.venue_unavailable", match.id, push);
      return match;
    }
    if (gate.ok) {
      const pick = suggested.candidates[0];
      match = await store.updateMatch(match.id, { state: "invite_ready" });
      events.emit(EVENTS.MATCH_INVITE_READY, {
        matchId: match.id,
        venueCandidates: suggested.candidates,
      });
      await publishClient(store, hub, "match.invite_ready", match.id, push);
      const venue = await store.createVenue({
        name: pick.name,
        cuisine: pick.cuisine,
        priceTier: pick.priceTier,
        approxNeighborhood: pick.approxNeighborhood,
        lat: (userA.homeLat + userB.homeLat) / 2,
        lng: (userA.homeLng + userB.homeLng) / 2,
        source: resolveVenueMode(process.env) === "places" ? "places" : "catalog",
      });
      const window = nextInviteWindow(userA.homeTz || "America/Denver");
      const invite = await store.createInvite({
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
      match = await store.updateMatch(match.id, { state: "invited" });
      await publishClient(store, hub, "invite.sent", match.id, push);
      return match;
    }
  }

  return (await store.getMatch(match.id))!;
}

const LIVE_MATCH_STATES = new Set<MatchState>(["exploring", "invite_ready", "invited", "booked"]);

export async function searchMatchForUser(input: {
  store: SparkStore;
  events: EventLog;
  userId: string;
  hub?: RealtimeHub;
  push?: PushDispatcher;
}): Promise<{ match?: MatchRecord; estimatedSeconds: number }> {
  const estimatedSeconds = BOT_SEARCH_ETA.typicalSeconds;
  const live = (await input.store.matchesForUser(input.userId)).find((m) =>
    LIVE_MATCH_STATES.has(m.state)
  );
  if (live) return { match: live, estimatedSeconds };

  const a = await snapshotFor(input.store, input.userId);
  let partnerId: string | undefined;
  for (const otherId of await input.store.listOtherUserIds(input.userId)) {
    const pair = await input.store.existingPair(input.userId, otherId);
    if (pair && LIVE_MATCH_STATES.has(pair.state)) {
      return { match: pair, estimatedSeconds };
    }
    if (pair && (pair.state === "declined" || pair.state === "archived")) continue;
    try {
      const b = await snapshotFor(input.store, otherId);
      if (passesHardFilter(a, b)) {
        partnerId = otherId;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!partnerId) return { estimatedSeconds };

  const engine = await createEngine(input.store);
  const match = await orchestrateMatch({
    store: input.store,
    events: input.events,
    hub: input.hub,
    push: input.push,
    engine,
    userAId: input.userId,
    userBId: partnerId,
  });
  return { match, estimatedSeconds };
}

export async function respondInvite(input: {
  store: SparkStore;
  events: EventLog;
  matchId: string;
  inviteId: string;
  userId: string;
  action: "accept" | "decline";
  carryCue?: string;
  hub?: RealtimeHub;
  push?: PushDispatcher;
}): Promise<{ match: MatchRecord }> {
  const match = await input.store.getMatch(input.matchId);
  const invite = await input.store.getInvite(input.inviteId);
  if (!match || !invite || invite.matchId !== match.id) {
    throw Object.assign(new Error("not_found"), { status: 404 });
  }
  if (match.userAId !== input.userId && match.userBId !== input.userId) {
    throw Object.assign(new Error("forbidden"), { status: 403 });
  }
  const isA = match.userAId === input.userId;
  const mine = isA ? invite.userAStatus : invite.userBStatus;
  const carryCue = normalizeCarryCue(input.carryCue);
  const carryPatch = carryCue
    ? isA
      ? { carryCueA: carryCue }
      : { carryCueB: carryCue }
    : {};

  if (input.action === "accept") {
    if (match.state === "declined" || invite.status === "declined") {
      throw Object.assign(new Error("invite_closed"), { status: 409 });
    }
    if (mine === "accepted" && (match.state === "booked" || match.state === "invited")) {
      if (carryCue) await input.store.updateInvite(invite.id, carryPatch);
      return { match };
    }
    const userAStatus = isA ? "accepted" : invite.userAStatus;
    const userBStatus = isA ? invite.userBStatus : "accepted";
    input.events.emit(EVENTS.INVITE_ACCEPTED, {
      matchId: match.id,
      userId: input.userId,
    });
    if (userAStatus === "accepted" && userBStatus === "accepted") {
      await input.store.updateInvite(invite.id, {
        userAStatus,
        userBStatus,
        status: "booked",
        ...carryPatch,
      });
      input.events.emit(EVENTS.INVITE_BOOKED, {
        matchId: match.id,
        inviteId: invite.id,
      });
      const booked = await input.store.updateMatch(match.id, { state: "booked" });
      await publishClient(input.store, input.hub, "invite.booked", match.id, input.push);
      return { match: booked };
    }
    await input.store.updateInvite(invite.id, { userAStatus, userBStatus, ...carryPatch });
    await publishClient(input.store, input.hub, "invite.accepted", match.id, input.push);
    return { match: (await input.store.getMatch(match.id))! };
  }

  if (match.state === "declined" || invite.status === "declined") {
    return { match };
  }
  if (match.state === "booked") {
    throw Object.assign(new Error("already_booked"), { status: 409 });
  }
  const userAStatus = isA ? "declined" : invite.userAStatus;
  const userBStatus = isA ? invite.userBStatus : "declined";
  await input.store.updateInvite(invite.id, {
    userAStatus,
    userBStatus,
    status: "declined",
  });
  input.events.emit(EVENTS.INVITE_DECLINED, {
    matchId: match.id,
    userId: input.userId,
  });
  const declined = await input.store.updateMatch(match.id, { state: "declined" });
  await publishClient(input.store, input.hub, "invite.declined", match.id, input.push);
  return { match: declined };
}
