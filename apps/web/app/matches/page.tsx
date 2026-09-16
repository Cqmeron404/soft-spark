"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientRealtimeEvent, MatchListItem } from "@soft-spark/shared";
import { ConnectingCaption, MatchCard, SoftToast } from "@soft-spark/ui";
import { listMatches, orchestrate } from "@/lib/api";
import { useMatchRealtime } from "@/lib/realtime";
import { readSession } from "@/lib/session";

export default function MatchesPage() {
  const router = useRouter();
  const [items, setItems] = useState<MatchListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [toast, setToast] = useState<{ matchId: string } | null>(null);

  async function load() {
    const session = readSession();
    if (!session) {
      router.replace("/signin");
      return;
    }
    try {
      setItems(await listMatches());
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) router.replace("/signin");
      else if (status === 404) router.replace("/onboard");
      else setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
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

  async function runJob() {
    setError(null);
    try {
      const result = await orchestrate();
      setNote(`Match ${result.state} · ${result.band}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Orchestrate failed");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 28, margin: 0 }}>
        Your bots are out
      </h1>
      <ConnectingCaption live={live} />
      <button type="button" className="ss-btn ss-btn-primary" onClick={() => void runJob()}>
        Run match job (demo)
      </button>
      {note ? <p style={{ color: "var(--ss-text-muted)", margin: 0 }}>{note}</p> : null}
      {toast ? (
        <SoftToast
          message="You’re both almost there — open invite"
          action="Open"
          onAction={() => router.push(`/matches/${toast.matchId}/invite`)}
          onDismiss={() => setToast(null)}
        />
      ) : null}
      {error ? <p style={{ color: "var(--ss-danger)" }}>{error}</p> : null}
      {items && items.length === 0 ? (
        <p style={{ color: "var(--ss-text-muted)" }}>
          No active matches yet — your bot’s exploring
        </p>
      ) : null}
      <div style={{ display: "grid", gap: 12 }}>
        {items?.map((m) => (
          <MatchCard
            key={m.id}
            peerName={m.peer?.displayName ?? "Someone"}
            band={m.band}
            reasons={m.reasons}
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
