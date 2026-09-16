"use client";

const KEY = "soft-spark.session";
const USERS_KEY = "soft-spark.users";
export const SESSION_EVENT = "soft-spark-session";

export type SessionUser = { id: string; displayName: string };

export function readSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function writeSession(user: SessionUser): void {
  localStorage.setItem(KEY, JSON.stringify(user));
  const all = readKnownUsers().filter(
    (u) => u.id !== user.id && u.displayName !== user.displayName
  );
  all.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function readKnownUsers(): SessionUser[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(USERS_KEY);
  const users = raw ? (JSON.parse(raw) as SessionUser[]) : [];
  const seen = new Set<string>();
  return users.filter((u) => {
    if (seen.has(u.displayName)) return false;
    seen.add(u.displayName);
    return true;
  });
}

export function dismissedKey(matchId: string): string {
  return `soft-spark.reveal-dismissed.${matchId}`;
}

export function isRevealDismissed(matchId: string): boolean {
  return localStorage.getItem(dismissedKey(matchId)) === "1";
}

export function dismissReveal(matchId: string): void {
  localStorage.setItem(dismissedKey(matchId), "1");
}
