import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { DEMO_PERSONAS } from "@soft-spark/shared";
import { account, user as authUser, type SparkDb } from "@soft-spark/db";
import { resolveMatchEngineMode } from "@soft-spark/match-engine";
import type { Auth } from "./auth.js";
import type { EventLog } from "./event-log.js";
import { completeOnboard } from "./onboard.js";
import { createEngine, orchestrateMatch } from "./orchestrate.js";
import type { PushDispatcher } from "./push.js";
import type { RealtimeHub } from "./realtime.js";
import type { SparkStore } from "./store.js";

export type EnsureDemoUsersDeps = {
  auth: Auth;
  db: SparkDb;
  store: SparkStore;
  events?: EventLog;
  hub?: RealtimeHub;
  push?: PushDispatcher;
};

export type DemoUserEnsureRow = {
  email: string;
  authId: string;
  userId: string;
  createdAuth: boolean;
  createdProfile: boolean;
};

export type EnsureDemoUsersResult = {
  ok: true;
  users: DemoUserEnsureRow[];
  match?: { id: string; state: string; seeded: boolean };
};

async function alignCredentialPassword(db: SparkDb, userId: string, password: string): Promise<void> {
  const hashed = await hashPassword(password);
  const [cred] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  if (!cred) {
    const now = new Date();
    await db.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }
  if (cred.password && (await verifyPassword({ hash: cred.password, password }))) return;
  await db
    .update(account)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(account.id, cred.id));
}

async function ensureAuthUser(
  auth: Auth,
  db: SparkDb,
  creds: { email: string; password: string; name: string }
): Promise<{ authId: string; createdAuth: boolean }> {
  try {
    const created = await auth.api.signUpEmail({
      body: { email: creds.email, password: creds.password, name: creds.name },
    });
    if (created?.user?.id) return { authId: created.user.id, createdAuth: true };
  } catch (err) {
    const [row] = await db.select().from(authUser).where(eq(authUser.email, creds.email));
    if (!row) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`demo sign-up failed for ${creds.email}: ${message}`);
    }
    await alignCredentialPassword(db, row.id, creds.password);
    return { authId: row.id, createdAuth: false };
  }
  const [row] = await db.select().from(authUser).where(eq(authUser.email, creds.email));
  if (!row) {
    throw new Error(`demo auth user missing after sign-up: ${creds.email}`);
  }
  await alignCredentialPassword(db, row.id, creds.password);
  return { authId: row.id, createdAuth: false };
}

async function seedDemoMatch(
  deps: EnsureDemoUsersDeps,
  userAId: string,
  userBId: string
): Promise<{ id: string; state: string; seeded: boolean } | undefined> {
  const existing = await deps.store.existingPair(userAId, userBId);
  if (existing) return { id: existing.id, state: existing.state, seeded: false };
  if (resolveMatchEngineMode(process.env).usedLlm) return undefined;
  if (!deps.events) return undefined;
  try {
    const engine = await createEngine(deps.store);
    const match = await orchestrateMatch({
      store: deps.store,
      events: deps.events,
      hub: deps.hub,
      push: deps.push,
      engine,
      userAId,
      userBId,
    });
    return { id: match.id, state: match.state, seeded: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`soft-spark-api: demo match seed skipped (${message})`);
    return undefined;
  }
}

/**
 * Idempotent Maya + Jordan Better Auth users, dating profiles, and (stub) match.
 * Passwords always match the public one-tap buttons. Does not weaken real auth.
 */
export async function ensureDemoUsers(deps: EnsureDemoUsersDeps): Promise<EnsureDemoUsersResult> {
  const users: DemoUserEnsureRow[] = [];
  for (const persona of DEMO_PERSONAS) {
    const { authId, createdAuth } = await ensureAuthUser(deps.auth, deps.db, persona.account);
    const onboard = await completeOnboard(deps.store, {
      authId,
      email: persona.account.email,
      body: persona.onboard,
    });
    users.push({
      email: persona.account.email,
      authId,
      userId: onboard.user.id,
      createdAuth,
      createdProfile: onboard.created,
    });
  }
  const maya = users[0];
  const jordan = users[1];
  const match =
    maya && jordan ? await seedDemoMatch(deps, maya.userId, jordan.userId) : undefined;
  return { ok: true, users, match };
}
