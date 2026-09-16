import type { ClientRealtimeEvent } from "@soft-spark/shared";
import { CLIENT_REALTIME_EVENTS } from "@soft-spark/shared";

export type RealtimeHub = {
  publish(userIds: string[], event: ClientRealtimeEvent): Promise<void>;
  subscribe(userId: string, fn: (event: ClientRealtimeEvent) => void): () => void;
};

function isClientEvent(type: string): type is ClientRealtimeEvent["type"] {
  return (CLIENT_REALTIME_EVENTS as readonly string[]).includes(type);
}

export function toClientEvent(
  type: string,
  payload: Record<string, unknown>,
  fields: Omit<ClientRealtimeEvent, "type">
): ClientRealtimeEvent | null {
  if (!isClientEvent(type)) return null;
  return { type, ...fields };
}

export function createMemoryRealtimeHub(): RealtimeHub {
  const listeners = new Map<string, Set<(event: ClientRealtimeEvent) => void>>();
  return {
    async publish(userIds, event) {
      for (const id of userIds) {
        const set = listeners.get(id);
        if (!set) continue;
        for (const fn of set) fn(event);
      }
      await publishPartykit(event);
    },
    subscribe(userId, fn) {
      const set = listeners.get(userId) ?? new Set();
      set.add(fn);
      listeners.set(userId, set);
      return () => {
        set.delete(fn);
      };
    },
  };
}

/** Partykit HTTP broadcast when PARTYKIT_HOST is set. No-op otherwise. */
async function publishPartykit(event: ClientRealtimeEvent): Promise<void> {
  const host = process.env.PARTYKIT_HOST;
  if (!host) return;
  const url = `${host.replace(/\/$/, "")}/parties/match/${event.matchId}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.PARTYKIT_TOKEN ? { authorization: `Bearer ${process.env.PARTYKIT_TOKEN}` } : {}),
      },
      body: JSON.stringify(event),
    });
  } catch {
    /* local demo still works via SSE */
  }
}

export const CLIENT_EVENT_ALLOWLIST = CLIENT_REALTIME_EVENTS;
