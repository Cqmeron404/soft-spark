import { formatMilesFromKm, type InviteUserStatus } from "@soft-spark/shared";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

let token: string | null = null;

export function setToken(value: string | null) {
  token = value;
}

export function getToken() {
  return token;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; token?: string };
  if (!res.ok) {
    const err = new Error(data.message ?? data.error ?? `HTTP ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  if (data && typeof data === "object" && "token" in data && typeof data.token === "string") {
    token = data.token;
  }
  return data as T;
}

export function signUp(body: { email: string; password: string; name: string }) {
  return api<{ user: { id: string; name?: string; email?: string }; token?: string }>("/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function signIn(body: { email: string; password: string }) {
  return api<{ user: { id: string; name?: string; email?: string }; token?: string }>("/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function acceptInvite(matchId: string, inviteId: string) {
  return api<MatchLike>(`/matches/${matchId}/invites/${inviteId}/accept`, { method: "POST" });
}

export function declineInvite(matchId: string, inviteId: string) {
  return api<MatchLike>(`/matches/${matchId}/invites/${inviteId}/decline`, { method: "POST" });
}

export function registerPush(expoToken: string) {
  return api<{ id: string }>("/users/me/push", {
    method: "POST",
    body: JSON.stringify({ platform: "expo", expoToken }),
  });
}

export { formatMilesFromKm };

export type MatchLike = {
  id: string;
  state: string;
  band: string;
  reasons: string[];
  peer?: { displayName: string; photoUrl?: string };
  invite?: {
    id: string;
    you: InviteUserStatus;
    them: InviteUserStatus;
    venue: {
      name: string;
      cuisine: string;
      travelKmYou: number;
      travelKmThem: number;
      approxNeighborhood: string;
    };
    window: { label: string; end?: string };
  };
};

