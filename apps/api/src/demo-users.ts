import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import {
  DEMO_ACCOUNTS,
  DEMO_JORDAN_ONBOARD,
  DEMO_MAYA_ONBOARD,
  type OnboardBody,
} from "@soft-spark/shared";
import { account, user as authUsers, type SparkDb } from "@soft-spark/db";
import type { createApp } from "./app.js";
import type { Auth } from "./auth.js";
import { allowDemoUsers } from "./env.js";
import type { EventLog } from "./event-log.js";
import { createEngine, orchestrateMatch } from "./orchestrate.js";
import type { PushDispatcher } from "./push.js";
import type { RealtimeHub } from "./realtime.js";
import type { SparkStore } from "./store.js";

type App = ReturnType<typeof createApp>;

type DemoAuth = {
  email: string;
  password: string;
  name: string;
};

const PERSONAS: Array<{ auth: DemoAuth; onboard: OnboardBody }> = [
  { auth: DEMO_ACCOUNTS.maya, onboard: DEMO_MAYA_ONBOARD },
  { auth: DEMO_ACCOUNTS.jordan, onboard: DEMO_JORDAN_ONBOARD },
];

export type DemoUserSeedResult = {
  mayaUserId: string;
  jordanUserId: string;
  matchId?: string;
};

export type DemoUserSeedDeps = {
  app: App;
  auth: Auth;
  db: SparkDb;
  store: SparkStore;
  events: EventLog;
  hub?: RealtimeHub;
  push?: PushDispatcher;
};

function cookiesFrom(res: Response): string {
  const parts =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

async function readAuth(res: Response): Promise<{
  status: number;
  headers: Record<string, string>;
  body: { token?: string; message?: string; user?: { id?: string } };
}> {
  const cookie = cookiesFrom(res);
  const body = (await res.json().catch(() => ({}))) as {
    token?: string;
    message?: string;
    user?: { id?: string };
  };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  if (body.token) headers.authorization = `Bearer ${body.token}`;
  return { status: res.status, headers, body };
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function realignCredentialPassword(db: SparkDb, email: string, password: string): Promise<void> {
  const [row] = await db.select().from(authUsers).where(eq(authUsers.email, email));
  if (!row) return;
  const hashed = await hashPassword(password);
  const [cred] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, row.id), eq(account.providerId, "credential")));
  if (cred) {
    await db
      .update(account)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(account.id, cred.id));
    return;
  }
  await db.insert(account).values({
    id: randomUUID(),
    accountId: row.id,
    providerId: "credential",
    userId: row.id,
    password: hashed,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function signIn(app: App, creds: DemoAuth) {
  return readAuth(
    await app.request("/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    })
  );
}

async function ensureAuthSession(app: App, db: SparkDb, creds: DemoAuth): Promise<Record<string, string>> {
  const signUp = await readAuth(
    await app.request("/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(creds),
    })
  );
  if (signUp.status < 400) return signUp.headers;

  const first = await signIn(app, creds);
  if (first.status < 400) return first.headers;

  await realignCredentialPassword(db, creds.email, creds.password);
  const retry = await signIn(app, creds);
  if (retry.status >= 400) {
    throw new Error(
      `demo user ${creds.email} sign-in failed ${retry.status} ${retry.body.message ?? ""}`
    );
  }
  return retry.headers;
}

async function ensureOnboarded(
  app: App,
  headers: Record<string, string>,
  onboard: OnboardBody
): Promise<{ id: string; displayName: string }> {
  const me = await app.request("/users/me", { headers });
  if (me.status === 200) {
    const current = await json<{ id: string; displayName: string; height?: string }>(me);
    if (!current.height) {
      await app.request("/users/me", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          profile: onboard.profile,
          photoUrl: onboard.photoUrl,
        }),
      });
    }
    const botRes = await app.request("/users/me/bot", { headers });
    const bot =
      botRes.status === 200
        ? await json<{ displayName?: string; publishedAt?: string }>(botRes)
        : undefined;
    if (onboard.botName && bot?.displayName !== onboard.botName) {
      await app.request("/users/me/bot", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ displayName: onboard.botName, vibeTags: onboard.vibeTags }),
      });
    }
    if (onboard.publish && !bot?.publishedAt) {
      await app.request("/users/me/bot/publish", {
        method: "POST",
        headers,
        body: JSON.stringify({ preferredAction: onboard.preferredAction ?? "wait" }),
      });
    }
    return current;
  }
  if (me.status !== 404) {
    throw new Error(`demo /users/me failed ${me.status} ${await me.text()}`);
  }
  const created = await app.request("/users/me/onboard", {
    method: "POST",
    headers,
    body: JSON.stringify(onboard),
  });
  if (created.status >= 400) {
    throw new Error(`demo onboard failed ${created.status} ${await created.text()}`);
  }
  const payload = await json<{ user: { id: string; displayName: string } }>(created);
  return payload.user;
}

async function ensureDemoMatch(
  deps: DemoUserSeedDeps,
  mayaUserId: string,
  jordanUserId: string
): Promise<string | undefined> {
  const existing = await deps.store.existingPair(mayaUserId, jordanUserId);
  if (existing) return existing.id;
  // Avoid OpenAI spend / boot latency when MATCH_ENGINE_MODE=llm.
  if ((process.env.MATCH_ENGINE_MODE ?? "stub") === "llm") return undefined;
  try {
    const engine = await createEngine(deps.store);
    const match = await orchestrateMatch({
      store: deps.store,
      events: deps.events,
      hub: deps.hub,
      push: deps.push,
      engine,
      userAId: mayaUserId,
      userBId: jordanUserId,
    });
    return match.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`soft-spark-api: demo Maya/Jordan match seed skipped (${message})`);
    return undefined;
  }
}

/**
 * Idempotent Maya + Jordan Better Auth users, onboarded profiles, and a stub match.
 * Safe on every API boot / Hobby cold start.
 */
export async function ensureDemoUsers(deps: DemoUserSeedDeps): Promise<DemoUserSeedResult> {
  const ids: string[] = [];
  for (const persona of PERSONAS) {
    const headers = await ensureAuthSession(deps.app, deps.db, persona.auth);
    const profile = await ensureOnboarded(deps.app, headers, persona.onboard);
    ids.push(profile.id);
  }
  const [mayaUserId, jordanUserId] = ids;
  if (!mayaUserId || !jordanUserId) {
    throw new Error("demo user seed missing Maya or Jordan profile id");
  }
  const matchId = await ensureDemoMatch(deps, mayaUserId, jordanUserId);
  return { mayaUserId, jordanUserId, matchId };
}

export async function maybeEnsureDemoUsers(deps: DemoUserSeedDeps): Promise<DemoUserSeedResult | undefined> {
  if (!allowDemoUsers()) return undefined;
  const result = await ensureDemoUsers(deps);
  console.log(
    `soft-spark-api: demo users ready (maya=${result.mayaUserId} jordan=${result.jordanUserId}${
      result.matchId ? ` match=${result.matchId}` : ""
    })`
  );
  return result;
}
