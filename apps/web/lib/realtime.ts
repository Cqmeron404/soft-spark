"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientRealtimeEvent } from "@soft-spark/shared";
import { API_URL } from "./api";
import { readToken } from "./auth";

export function useMatchRealtime(onEvent: (event: ClientRealtimeEvent) => void) {
  const [live, setLive] = useState(false);
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    const token = readToken();
    const url = new URL(`${API_URL}/realtime/stream`);
    if (token) url.searchParams.set("access_token", token);
    const es = new EventSource(url.toString(), { withCredentials: true });
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    const types = [
      "match.score.updated",
      "match.invite_ready",
      "match.venue_unavailable",
      "invite.sent",
      "invite.accepted",
      "invite.declined",
      "invite.booked",
    ];
    for (const type of types) {
      es.addEventListener(type, (msg) => {
        try {
          cb.current(JSON.parse((msg as MessageEvent).data) as ClientRealtimeEvent);
        } catch {
          /* ignore malformed */
        }
      });
    }
    return () => es.close();
  }, []);

  return live;
}
