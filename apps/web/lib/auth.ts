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
    return null;
  } catch {
    return null;
  }
}
