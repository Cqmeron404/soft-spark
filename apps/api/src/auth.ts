import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import { eq } from "drizzle-orm";
import {
  account,
  session,
  user,
  verification,
  type SparkDb,
} from "@soft-spark/db";
import { DEV_AUTH_SECRET } from "./env.js";

export function createAuth(db: SparkDb) {
  const secret =
    process.env.BETTER_AUTH_SECRET ??
    process.env.AUTH_SECRET ??
    DEV_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL ?? process.env.API_URL ?? "http://localhost:8787";
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  return betterAuth({
    basePath: "/auth",
    secret,
    baseURL,
    trustedOrigins: [webOrigin, "softspark://", "exp://"],
    emailAndPassword: { enabled: true },
    plugins: [expo()],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

export function authMode(): "prod" | "dev" {
  if (process.env.AUTH_MODE === "prod" || process.env.NODE_ENV === "production") return "prod";
  return "dev";
}

export type AuthSession = { user: { id: string; email?: string | null; name?: string | null } };

/** Cookie session, or Bearer token from Better Auth / Expo (unsigned session token id). */
export async function resolveSession(
  auth: Auth,
  db: SparkDb,
  requestHeaders: Headers
): Promise<AuthSession | null> {
  const headers = new Headers(requestHeaders);
  const bearer = headers.get("authorization");
  const token = bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : null;
  if (token && !headers.get("cookie")?.includes("better-auth.session_token")) {
    headers.set("cookie", `better-auth.session_token=${token}`);
  }
  const fromAuth = await auth.api.getSession({ headers });
  if (fromAuth?.user?.id) {
    return { user: { id: fromAuth.user.id, email: fromAuth.user.email, name: fromAuth.user.name } };
  }
  if (!token) return null;
  const unsigned = decodeURIComponent(token.split(".")[0] ?? token);
  const [row] = await db.select().from(session).where(eq(session.token, unsigned));
  if (!row || row.expiresAt <= new Date()) return null;
  const [authUser] = await db.select().from(user).where(eq(user.id, row.userId));
  if (!authUser) return null;
  return { user: { id: authUser.id, email: authUser.email, name: authUser.name } };
}

