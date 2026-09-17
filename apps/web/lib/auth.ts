import { API_URL } from "./api";

const TOKEN_KEY = "soft-spark.auth-token";

export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function writeToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type AuthUser = { id: string; name?: string | null; email?: string | null };

async function authJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const token = readToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string; token?: string };
  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
  }
  if (data.token) writeToken(data.token);
  return data;
}

export function signUpEmail(input: { email: string; password: string; name: string }) {
  return authJson<{ user: AuthUser; token?: string }>("/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signInEmail(input: { email: string; password: string }) {
  return authJson<{ user: AuthUser; token?: string }>("/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function signOut() {
  try {
    await Promise.race([
      authJson("/auth/sign-out", { method: "POST" }),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("sign-out timeout")), 4000)),
    ]);
  } catch {
    // Cookie clear still happens in finally so Welcome can mint a new guest.
  } finally {
    writeToken(null);
  }
}

export async function getAuthSession(): Promise<{ user: AuthUser } | null> {
  try {
    const data = await authJson<{ user?: AuthUser } | { session?: unknown; user?: AuthUser }>(
      "/auth/get-session"
    );
    if (data && "user" in data && data.user) return { user: data.user };
  } catch {
    // Cookie get-session is empty on cross-site Hobby; Bearer still works on API routes.
  }
  return sessionFromBearer();
}

/** Hobby web: cookies are third-party; resolveSession honors Authorization on /users/me. */
async function sessionFromBearer(): Promise<{ user: AuthUser } | null> {
  const token = readToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      credentials: "include",
    });
    if (res.status === 401) {
      writeToken(null);
      return null;
    }
    if (res.ok) {
      const data = (await res.json()) as { id?: string; displayName?: string };
      if (data.id) return { user: { id: data.id, name: data.displayName } };
    }
    // 404 profile_incomplete still means this Bearer is a real session.
    return { user: { id: "bearer", name: null } };
  } catch {
    return { user: { id: "bearer", name: null } };
  }
}
