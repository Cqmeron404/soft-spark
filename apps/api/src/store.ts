import { randomUUID } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import {
  conversations,
  datingBots,
  invites,
  matches,
  messages,
  preferences,
  pushDevices,
  users,
  venueCatalog,
  venues,
  type SparkDb,
} from "@soft-spark/db";
import type {
  ConfidenceBand,
  InviteStatus,
  InviteUserStatus,
  LookingFor,
  MatchState,
  PriceTier,
} from "@soft-spark/shared";
import type { ChemistryDims, Place } from "@soft-spark/match-engine";

export type UserRecord = {
  id: string;
  authId: string;
  email: string;
  displayName: string;
  age: number;
  gender: string;
  interestedIn: string[];
  bio?: string;
  photoUrl?: string;
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

export type PushDeviceRecord = {
  id: string;
  userId: string;
  platform: "web" | "expo";
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  expoToken?: string;
  createdAt: string;
};

function asPush(row: typeof pushDevices.$inferSelect): PushDeviceRecord {
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform === "expo" ? "expo" : "web",
    endpoint: row.endpoint ?? undefined,
    p256dh: row.p256dh ?? undefined,
    auth: row.auth ?? undefined,
    expoToken: row.expoToken ?? undefined,
    createdAt: iso(row.createdAt),
  };
}

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

function asUser(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    authId: row.authId,
    email: row.email,
    displayName: row.displayName,
    age: row.age,
    gender: row.gender,
    interestedIn: row.interestedIn ?? [],
    bio: row.bio ?? undefined,
    photoUrl: row.photoUrl ?? undefined,
    homeLat: row.homeLat,
    homeLng: row.homeLng,
    homeTz: row.homeTz,
    botDatingOptIn: row.botDatingOptIn,
    status: row.status,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function asBot(row: typeof datingBots.$inferSelect): BotRecord {
  return {
    id: row.id,
    userId: row.userId,
    vibeTags: row.vibeTags ?? [],
    active: row.active,
    paused: row.paused,
  };
}

function asPrefs(row: typeof preferences.$inferSelect): PreferenceRecord {
  return {
    id: row.id,
    userId: row.userId,
    cuisine: row.cuisine ?? [],
    budget: row.budget as PriceTier,
    maxTravelKm: row.maxTravelKm,
    dealbreakers: row.dealbreakers ?? [],
    lookingFor: (row.lookingFor as LookingFor) ?? "unsure",
    interests: row.interests ?? [],
  };
}

function asMatch(row: typeof matches.$inferSelect): MatchRecord {
  return {
    id: row.id,
    userAId: row.userAId,
    userBId: row.userBId,
    state: row.state as MatchState,
    confidence: row.confidence,
    band: row.band as ConfidenceBand,
    reasons: row.reasons ?? [],
    safetyOk: row.safetyOk,
    profileFit: row.profileFit,
    chemistry: row.chemistry,
    logistics: row.logistics,
    chemistryDims: row.chemistryDims,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function asConvo(row: typeof conversations.$inferSelect): ConversationRecord {
  return { id: row.id, matchId: row.matchId, startedAt: iso(row.startedAt) };
}

function asMessage(row: typeof messages.$inferSelect): MessageRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as "botA" | "botB",
    text: row.text,
    safetyOk: row.safetyOk,
    createdAt: iso(row.createdAt),
  };
}

function asVenue(row: typeof venues.$inferSelect): VenueRecord {
  return {
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    priceTier: row.priceTier as PriceTier,
    approxNeighborhood: row.approxNeighborhood,
    lat: row.lat,
    lng: row.lng,
    source: row.source,
  };
}

function asInvite(row: typeof invites.$inferSelect): InviteRecord {
  return {
    id: row.id,
    matchId: row.matchId,
    venueId: row.venueId,
    windowStart: iso(row.windowStart),
    windowEnd: iso(row.windowEnd),
    windowLabel: row.windowLabel,
    timeZone: row.timeZone,
    status: row.status as InviteStatus,
    userAStatus: row.userAStatus as InviteUserStatus,
    userBStatus: row.userBStatus as InviteUserStatus,
    travelKmA: row.travelKmA,
    travelKmB: row.travelKmB,
    why: row.why,
    createdAt: iso(row.createdAt),
  };
}

export function createDbStore(db: SparkDb) {
  return {
    async getUser(id: string): Promise<UserRecord | undefined> {
      const [row] = await db.select().from(users).where(eq(users.id, id));
      return row ? asUser(row) : undefined;
    },
    async userByAuthId(authId: string): Promise<UserRecord | undefined> {
      const [row] = await db.select().from(users).where(eq(users.authId, authId));
      return row ? asUser(row) : undefined;
    },
    async createUser(
      input: Omit<UserRecord, "id" | "createdAt" | "updatedAt" | "status"> & { id?: string }
    ): Promise<UserRecord> {
      const id = input.id ?? randomUUID();
      const [row] = await db
        .insert(users)
        .values({
          id,
          authId: input.authId,
          email: input.email,
          displayName: input.displayName,
          age: input.age,
          gender: input.gender,
          interestedIn: input.interestedIn,
          bio: input.bio,
          photoUrl: input.photoUrl,
          homeLat: input.homeLat,
          homeLng: input.homeLng,
          homeTz: input.homeTz,
          botDatingOptIn: input.botDatingOptIn,
        })
        .returning();
      return asUser(row);
    },
    async updateUser(id: string, patch: Partial<UserRecord>): Promise<UserRecord> {
      const [row] = await db
        .update(users)
        .set(
          compact({
            displayName: patch.displayName,
            age: patch.age,
            gender: patch.gender,
            interestedIn: patch.interestedIn,
            bio: patch.bio,
            photoUrl: patch.photoUrl,
            homeLat: patch.homeLat,
            homeLng: patch.homeLng,
            homeTz: patch.homeTz,
            updatedAt: new Date(),
          })
        )
        .where(eq(users.id, id))
        .returning();
      if (!row) throw new Error(`user ${id} not found`);
      return asUser(row);
    },
    async createBot(input: Omit<BotRecord, "id"> & { id?: string }): Promise<BotRecord> {
      const [row] = await db
        .insert(datingBots)
        .values({
          id: input.id ?? randomUUID(),
          userId: input.userId,
          vibeTags: input.vibeTags,
          active: input.active,
          paused: input.paused,
        })
        .returning();
      return asBot(row);
    },
    async botForUser(userId: string): Promise<BotRecord | undefined> {
      const [row] = await db.select().from(datingBots).where(eq(datingBots.userId, userId));
      return row ? asBot(row) : undefined;
    },
    async updateBot(userId: string, patch: Partial<BotRecord>): Promise<BotRecord> {
      const cur = await this.botForUser(userId);
      if (!cur) throw new Error(`bot missing for ${userId}`);
      const [row] = await db
        .update(datingBots)
        .set({
          vibeTags: patch.vibeTags ?? cur.vibeTags,
          paused: patch.paused ?? cur.paused,
          active: patch.active ?? cur.active,
        })
        .where(eq(datingBots.id, cur.id))
        .returning();
      return asBot(row);
    },
    async createPrefs(input: Omit<PreferenceRecord, "id"> & { id?: string }): Promise<PreferenceRecord> {
      const [row] = await db
        .insert(preferences)
        .values({
          id: input.id ?? randomUUID(),
          userId: input.userId,
          cuisine: input.cuisine,
          budget: input.budget,
          maxTravelKm: input.maxTravelKm,
          dealbreakers: input.dealbreakers,
          lookingFor: input.lookingFor,
          interests: input.interests,
        })
        .returning();
      return asPrefs(row);
    },
    async prefsForUser(userId: string): Promise<PreferenceRecord> {
      const [row] = await db.select().from(preferences).where(eq(preferences.userId, userId));
      if (!row) throw new Error(`prefs missing for ${userId}`);
      return asPrefs(row);
    },
    async updatePrefs(userId: string, patch: Partial<PreferenceRecord>): Promise<PreferenceRecord> {
      const cur = await this.prefsForUser(userId);
      const [row] = await db
        .update(preferences)
        .set({
          cuisine: patch.cuisine ?? cur.cuisine,
          budget: patch.budget ?? cur.budget,
          maxTravelKm: patch.maxTravelKm ?? cur.maxTravelKm,
          dealbreakers: patch.dealbreakers ?? cur.dealbreakers,
          lookingFor: patch.lookingFor ?? cur.lookingFor,
          interests: patch.interests ?? cur.interests,
        })
        .where(eq(preferences.id, cur.id))
        .returning();
      return asPrefs(row);
    },
    async createMatch(
      input: Omit<MatchRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }
    ): Promise<MatchRecord> {
      const [row] = await db
        .insert(matches)
        .values({
          id: input.id ?? randomUUID(),
          userAId: input.userAId,
          userBId: input.userBId,
          state: input.state,
          confidence: input.confidence,
          band: input.band,
          reasons: input.reasons,
          safetyOk: input.safetyOk,
          profileFit: input.profileFit,
          chemistry: input.chemistry,
          logistics: input.logistics,
          chemistryDims: input.chemistryDims,
        })
        .returning();
      return asMatch(row);
    },
    async getMatch(id: string): Promise<MatchRecord | undefined> {
      const [row] = await db.select().from(matches).where(eq(matches.id, id));
      return row ? asMatch(row) : undefined;
    },
    async updateMatch(id: string, patch: Partial<MatchRecord>): Promise<MatchRecord> {
      const [row] = await db
        .update(matches)
        .set(
          compact({
            state: patch.state,
            confidence: patch.confidence,
            band: patch.band,
            reasons: patch.reasons,
            safetyOk: patch.safetyOk,
            profileFit: patch.profileFit,
            chemistry: patch.chemistry,
            logistics: patch.logistics,
            chemistryDims: patch.chemistryDims,
            updatedAt: new Date(),
          })
        )
        .where(eq(matches.id, id))
        .returning();
      if (!row) throw new Error(`match ${id} not found`);
      return asMatch(row);
    },
    async createConversation(matchId: string): Promise<ConversationRecord> {
      const [row] = await db
        .insert(conversations)
        .values({ id: randomUUID(), matchId })
        .returning();
      return asConvo(row);
    },
    async conversationForMatch(matchId: string): Promise<ConversationRecord | undefined> {
      const [row] = await db.select().from(conversations).where(eq(conversations.matchId, matchId));
      return row ? asConvo(row) : undefined;
    },
    async addMessage(input: Omit<MessageRecord, "id" | "createdAt">): Promise<MessageRecord> {
      const [row] = await db
        .insert(messages)
        .values({
          id: randomUUID(),
          conversationId: input.conversationId,
          role: input.role,
          text: input.text,
          safetyOk: input.safetyOk,
        })
        .returning();
      return asMessage(row);
    },
    async messagesFor(conversationId: string): Promise<MessageRecord[]> {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId));
      return rows.map(asMessage);
    },
    async createVenue(input: Omit<VenueRecord, "id"> & { id?: string }): Promise<VenueRecord> {
      const [row] = await db
        .insert(venues)
        .values({
          id: input.id ?? randomUUID(),
          name: input.name,
          cuisine: input.cuisine,
          priceTier: input.priceTier,
          approxNeighborhood: input.approxNeighborhood,
          lat: input.lat,
          lng: input.lng,
          source: input.source,
        })
        .returning();
      return asVenue(row);
    },
    async getVenue(id: string): Promise<VenueRecord | undefined> {
      const [row] = await db.select().from(venues).where(eq(venues.id, id));
      return row ? asVenue(row) : undefined;
    },
    async createInvite(input: Omit<InviteRecord, "id" | "createdAt"> & { id?: string }): Promise<InviteRecord> {
      const [row] = await db
        .insert(invites)
        .values({
          id: input.id ?? randomUUID(),
          matchId: input.matchId,
          venueId: input.venueId,
          windowStart: new Date(input.windowStart),
          windowEnd: new Date(input.windowEnd),
          windowLabel: input.windowLabel,
          timeZone: input.timeZone,
          status: input.status,
          userAStatus: input.userAStatus,
          userBStatus: input.userBStatus,
          travelKmA: input.travelKmA,
          travelKmB: input.travelKmB,
          why: input.why,
        })
        .returning();
      return asInvite(row);
    },
    async getInvite(id: string): Promise<InviteRecord | undefined> {
      const [row] = await db.select().from(invites).where(eq(invites.id, id));
      return row ? asInvite(row) : undefined;
    },
    async inviteForMatch(matchId: string): Promise<InviteRecord | undefined> {
      const [row] = await db.select().from(invites).where(eq(invites.matchId, matchId));
      return row ? asInvite(row) : undefined;
    },
    async updateInvite(id: string, patch: Partial<InviteRecord>): Promise<InviteRecord> {
      const [row] = await db
        .update(invites)
        .set(
          compact({
            status: patch.status,
            userAStatus: patch.userAStatus,
            userBStatus: patch.userBStatus,
          })
        )
        .where(eq(invites.id, id))
        .returning();
      if (!row) throw new Error(`invite ${id} not found`);
      return asInvite(row);
    },
    async matchesForUser(userId: string): Promise<MatchRecord[]> {
      const rows = await db
        .select()
        .from(matches)
        .where(or(eq(matches.userAId, userId), eq(matches.userBId, userId)))
        .orderBy(desc(matches.updatedAt));
      return rows.map(asMatch);
    },
    async existingPair(userAId: string, userBId: string): Promise<MatchRecord | undefined> {
      const [row] = await db
        .select()
        .from(matches)
        .where(
          or(
            and(eq(matches.userAId, userAId), eq(matches.userBId, userBId)),
            and(eq(matches.userAId, userBId), eq(matches.userBId, userAId))
          )
        );
      return row ? asMatch(row) : undefined;
    },
    async listCatalog(): Promise<Place[]> {
      const rows = await db.select().from(venueCatalog);
      return rows.map((r) => ({
        name: r.name,
        cuisine: r.cuisine,
        priceTier: r.priceTier as Place["priceTier"],
        geo: { lat: r.lat, lng: r.lng },
        neighborhood: r.approxNeighborhood,
      }));
    },
    async lastUserIds(n = 2): Promise<string[]> {
      const rows = await db.select().from(users).orderBy(desc(users.createdAt));
      return rows.slice(0, n).reverse().map((u) => u.id);
    },
    async upsertPushDevice(input: {
      userId: string;
      platform: "web" | "expo";
      endpoint?: string;
      p256dh?: string;
      auth?: string;
      expoToken?: string;
    }): Promise<PushDeviceRecord> {
      if (input.platform === "web" && input.endpoint) {
        const [existing] = await db
          .select()
          .from(pushDevices)
          .where(and(eq(pushDevices.userId, input.userId), eq(pushDevices.endpoint, input.endpoint)));
        if (existing) {
          const [row] = await db
            .update(pushDevices)
            .set({ p256dh: input.p256dh, auth: input.auth, platform: "web" })
            .where(eq(pushDevices.id, existing.id))
            .returning();
          return asPush(row);
        }
      }
      if (input.platform === "expo" && input.expoToken) {
        const [existing] = await db
          .select()
          .from(pushDevices)
          .where(and(eq(pushDevices.userId, input.userId), eq(pushDevices.expoToken, input.expoToken)));
        if (existing) return asPush(existing);
      }
      const [row] = await db
        .insert(pushDevices)
        .values({
          id: randomUUID(),
          userId: input.userId,
          platform: input.platform,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          expoToken: input.expoToken,
        })
        .returning();
      return asPush(row);
    },
    async listPushDevices(userId: string): Promise<PushDeviceRecord[]> {
      const rows = await db.select().from(pushDevices).where(eq(pushDevices.userId, userId));
      return rows.map(asPush);
    },
    async deletePushDevice(userId: string, id: string): Promise<void> {
      await db.delete(pushDevices).where(and(eq(pushDevices.id, id), eq(pushDevices.userId, userId)));
    },
  };
}

export type SparkStore = ReturnType<typeof createDbStore>;
