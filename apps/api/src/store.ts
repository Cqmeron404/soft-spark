import { randomUUID } from "node:crypto";
import type {
  ConfidenceBand,
  InviteStatus,
  InviteUserStatus,
  LookingFor,
  MatchState,
  PriceTier,
} from "@soft-spark/shared";
import type { ChemistryDims } from "@soft-spark/match-engine";

export type UserRecord = {
  id: string;
  displayName: string;
  age: number;
  gender: string;
  interestedIn: string[];
  bio?: string;
  homeLat: number;
  homeLng: number;
  homeTz: string;
  botDatingOptIn: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type BotRecord = {
  id: string;
  userId: string;
  vibeTags: string[];
  active: boolean;
  paused: boolean;
};

export type PreferenceRecord = {
  id: string;
  userId: string;
  cuisine: string[];
  budget: PriceTier;
  maxTravelKm: number;
  dealbreakers: string[];
  lookingFor: LookingFor;
  interests: string[];
};

export type MatchRecord = {
  id: string;
  userAId: string;
  userBId: string;
  state: MatchState;
  confidence: number;
  band: ConfidenceBand;
  reasons: string[];
  safetyOk: boolean;
  profileFit: number;
  chemistry: number;
  logistics: number;
  chemistryDims: ChemistryDims;
  createdAt: string;
  updatedAt: string;
};

export type ConversationRecord = {
  id: string;
  matchId: string;
  startedAt: string;
};

export type MessageRecord = {
  id: string;
  conversationId: string;
  role: "botA" | "botB";
  text: string;
  safetyOk: boolean;
  createdAt: string;
};

export type VenueRecord = {
  id: string;
  name: string;
  cuisine: string;
  priceTier: PriceTier;
  approxNeighborhood: string;
  lat: number;
  lng: number;
  source: string;
};

export type InviteRecord = {
  id: string;
  matchId: string;
  venueId: string;
  windowStart: string;
  windowEnd: string;
  windowLabel: string;
  timeZone: string;
  status: InviteStatus;
  userAStatus: InviteUserStatus;
  userBStatus: InviteUserStatus;
  travelKmA: number;
  travelKmB: number;
  why: string;
  createdAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export class MemoryStore {
  users = new Map<string, UserRecord>();
  bots = new Map<string, BotRecord>();
  prefs = new Map<string, PreferenceRecord>();
  matches = new Map<string, MatchRecord>();
  conversations = new Map<string, ConversationRecord>();
  messages: MessageRecord[] = [];
  venues = new Map<string, VenueRecord>();
  invites = new Map<string, InviteRecord>();

  createUser(input: Omit<UserRecord, "id" | "createdAt" | "updatedAt" | "status">): UserRecord {
    const id = randomUUID();
    const ts = nowIso();
    const user: UserRecord = { ...input, id, status: "active", createdAt: ts, updatedAt: ts };
    this.users.set(id, user);
    return user;
  }

  createBot(input: Omit<BotRecord, "id">): BotRecord {
    const bot: BotRecord = { ...input, id: randomUUID() };
    this.bots.set(bot.id, bot);
    return bot;
  }

  botForUser(userId: string): BotRecord | undefined {
    return [...this.bots.values()].find((b) => b.userId === userId);
  }

  createPrefs(input: Omit<PreferenceRecord, "id">): PreferenceRecord {
    const prefs: PreferenceRecord = { ...input, id: randomUUID() };
    this.prefs.set(prefs.userId, prefs);
    return prefs;
  }

  prefsForUser(userId: string): PreferenceRecord {
    const p = this.prefs.get(userId);
    if (!p) throw new Error(`prefs missing for ${userId}`);
    return p;
  }

  createMatch(input: Omit<MatchRecord, "id" | "createdAt" | "updatedAt">): MatchRecord {
    const ts = nowIso();
    const match: MatchRecord = { ...input, id: randomUUID(), createdAt: ts, updatedAt: ts };
    this.matches.set(match.id, match);
    return match;
  }

  updateMatch(id: string, patch: Partial<MatchRecord>): MatchRecord {
    const cur = this.matches.get(id);
    if (!cur) throw new Error(`match ${id} not found`);
    const next = { ...cur, ...patch, id, updatedAt: nowIso() };
    this.matches.set(id, next);
    return next;
  }

  createConversation(matchId: string): ConversationRecord {
    const rec: ConversationRecord = { id: randomUUID(), matchId, startedAt: nowIso() };
    this.conversations.set(rec.id, rec);
    return rec;
  }

  conversationForMatch(matchId: string): ConversationRecord | undefined {
    return [...this.conversations.values()].find((c) => c.matchId === matchId);
  }

  addMessage(input: Omit<MessageRecord, "id" | "createdAt">): MessageRecord {
    const rec: MessageRecord = { ...input, id: randomUUID(), createdAt: nowIso() };
    this.messages.push(rec);
    return rec;
  }

  messagesFor(conversationId: string): MessageRecord[] {
    return this.messages.filter((m) => m.conversationId === conversationId);
  }

  createVenue(input: Omit<VenueRecord, "id">): VenueRecord {
    const rec: VenueRecord = { ...input, id: randomUUID() };
    this.venues.set(rec.id, rec);
    return rec;
  }

  createInvite(input: Omit<InviteRecord, "id" | "createdAt">): InviteRecord {
    const rec: InviteRecord = { ...input, id: randomUUID(), createdAt: nowIso() };
    this.invites.set(rec.id, rec);
    return rec;
  }

  inviteForMatch(matchId: string): InviteRecord | undefined {
    return [...this.invites.values()].find((i) => i.matchId === matchId);
  }

  updateInvite(id: string, patch: Partial<InviteRecord>): InviteRecord {
    const cur = this.invites.get(id);
    if (!cur) throw new Error(`invite ${id} not found`);
    const next = { ...cur, ...patch, id };
    this.invites.set(id, next);
    return next;
  }

  matchesForUser(userId: string): MatchRecord[] {
    return [...this.matches.values()]
      .filter((m) => m.userAId === userId || m.userBId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  existingPair(userAId: string, userBId: string): MatchRecord | undefined {
    return [...this.matches.values()].find(
      (m) =>
        (m.userAId === userAId && m.userBId === userBId) ||
        (m.userAId === userBId && m.userBId === userAId)
    );
  }
}

export const store = new MemoryStore();
