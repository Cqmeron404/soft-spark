import type { MatchDetail, MatchListItem, MatchSearchResult, OnboardBody, UserDto } from "@soft-spark/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("content-type") && options.body) headers.set("content-type", "application/json");
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("soft-spark.auth-token");
    if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? `HTTP ${res.status}`) as Error & {
      status: number;
    };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export function getMe() {
  return api<UserDto>("/users/me");
}

export function onboard(body: OnboardBody) {
  return api<{ user: { id: string; displayName: string }; bot: { id: string } }>(
    "/users/me/onboard",
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function listMatches() {
  return api<MatchListItem[]>("/matches");
}

export function getMatch(id: string) {
  return api<MatchDetail>(`/matches/${id}`);
}

export function acceptInvite(matchId: string, inviteId: string, carryCue?: string) {
  return api<MatchDetail>(`/matches/${matchId}/invites/${inviteId}/accept`, {
    method: "POST",
    body: JSON.stringify(carryCue ? { carryCue } : {}),
  });
}

export function declineInvite(matchId: string, inviteId: string) {
  return api<MatchDetail>(`/matches/${matchId}/invites/${inviteId}/decline`, { method: "POST" });
}

/** Authenticated stub search. Do not call /internal/orchestrate from the browser. */
export function searchForDate() {
  return api<MatchSearchResult>("/matches/search", {
    method: "POST",
    body: "{}",
  });
}

export function patchBot(body: { paused?: boolean; vibeTags?: string[] }) {
  return api<{ id: string; paused: boolean }>("/users/me/bot", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
