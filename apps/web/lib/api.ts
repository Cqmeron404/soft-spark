import type { MatchDetail, MatchListItem, OnboardBody } from "@soft-spark/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export async function api<T>(
  path: string,
  options: RequestInit & { userId?: string | null } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (options.userId) headers.set("x-user-id", options.userId);
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export function onboard(body: OnboardBody) {
  return api<{ user: { id: string; displayName: string }; bot: { id: string } }>(
    "/users/me/onboard",
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function listMatches(userId: string) {
  return api<MatchListItem[]>("/matches", { userId });
}

export function getMatch(userId: string, id: string) {
  return api<MatchDetail>(`/matches/${id}`, { userId });
}

export function acceptInvite(userId: string, matchId: string, inviteId: string) {
  return api<MatchDetail>(`/matches/${matchId}/invites/${inviteId}/accept`, {
    method: "POST",
    userId,
  });
}

export function declineInvite(userId: string, matchId: string, inviteId: string) {
  return api<MatchDetail>(`/matches/${matchId}/invites/${inviteId}/decline`, {
    method: "POST",
    userId,
  });
}

export function orchestrate(userAId?: string, userBId?: string) {
  return api<{ matchId: string; state: string; band: string }>("/internal/orchestrate", {
    method: "POST",
    body: JSON.stringify({ userAId, userBId }),
  });
}
