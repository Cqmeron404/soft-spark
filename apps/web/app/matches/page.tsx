"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientRealtimeEvent, MatchListItem } from "@soft-spark/shared";
import { ConnectingCaption, MatchCard, SoftToast } from "@soft-spark/ui";
import { BotSearchAction } from "@/components/BotSearchAction";
import { listMatches } from "@/lib/api";
import { useMatchRealtime } from "@/lib/realtime";
import { readSession } from "@/lib/session";

function isLiveMatch(state: string) {
  return state === "exploring" || state === "invite_ready" || state === "invited" || state === "booked";
}

export default function MatchesPage() {
  const router = useRouter();
  const [autoRoam, setAutoRoam] = useState(false);
  const [items, setItems] = useState<MatchListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ matchId: string } | null>(null);

  async function load() {
    const session = readSession();
    if (!session) {
      router.replace("/auth/sign-in");
      return;
    }
    try {
      setItems(await listMatches());
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) router.replace("/auth/sign-in");
      else if (status === 404) router.replace("/onboard");
      else setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    setAutoRoam(new URLSearchParams(window.location.search).get("roam") === "1");
    void load();
  }, []);

  const live = useMatchRealtime((event: ClientRealtimeEvent) => {
    if (event.type === "invite.accepted" && event.invite?.userAStatus !== event.invite?.userBStatus) {
      setToast({ matchId: event.matchId });
    }
    setItems((cur) => {
      if (!cur) return cur;
      return cur.map((m) =>
        m.id === event.matchId
          ? { ...m, state: event.state, band: event.band, reasons: event.reasons, updatedAt: new Date().toISOString() }
          : m
      );
    });
  });

  const liveItems = items?.filter((m) => isLiveMatch(m.state)) ?? [];
  const showSearch = items !== null && liveItems.length === 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13, fontWeight: 600 }}>Roam</p>
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 28, margin: 0 }}>
        Your bots are out
      </h1>
      <ConnectingCaption live={live} />
      {toast ? (
        <SoftToast
          message="You’re both almost there — open invite"
          action="Open"
          onAction={() => router.push(`/matches/${toast.matchId}/invite`)}
          onDismiss={() => setToast(null)}
        />
      ) : null}
      {error ? <p className="ss-error">{error === "unauthorized" ? "Sign in to keep your bot dating" : error}</p> : null}
      {showSearch ? <BotSearchAction autoStart={autoRoam} /> : null}
      <div style={{ display: "grid", gap: 12 }}>
        {items?.map((m) => (
          <MatchCard
            key={m.id}
            peerName={m.peer?.displayName ?? "Someone"}
            band={m.band}
            reasons={m.reasons}
            photoUrl={m.peer?.photoUrl}
            onOpen={() => {
              if (m.state === "invite_ready" || m.state === "invited" || m.state === "booked") {
                router.push(`/matches/${m.id}/reveal`);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
