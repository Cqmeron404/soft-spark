"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ClientRealtimeEvent, MatchListItem } from "@soft-spark/shared";
import { ConnectingCaption, MatchCard, SoftToast } from "@soft-spark/ui";
import { BotSearchAction, matchHref } from "@/components/BotSearchAction";
import { getBot, listMatches } from "@/lib/api";
import { ensureGuestSession } from "@/lib/guest-session";
import { useMatchRealtime } from "@/lib/realtime";
import { readSession } from "@/lib/session";

function isLiveMatch(state: string) {
  return state === "exploring" || state === "invite_ready" || state === "invited" || state === "booked";
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<p style={{ color: "var(--ss-text-muted)" }}>Catching up…</p>}>
      <MatchesBody />
    </Suspense>
  );
}

function MatchesBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoRoam = searchParams.get("roam") === "1";
  const [items, setItems] = useState<MatchListItem[] | null>(null);
  const [botName, setBotName] = useState("Your bot");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ matchId: string } | null>(null);

  async function load() {
    try {
      await ensureGuestSession();
    } catch {
      router.replace("/");
      return;
    }
    if (!readSession()) {
      router.replace("/");
      return;
    }
    try {
      setItems(await listMatches());
      try {
        const bot = await getBot();
        setBotName(bot.botDisplayName ?? bot.displayName ?? "Your bot");
      } catch {
        router.replace("/onboard");
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) router.replace("/");
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

  const liveItems = items?.filter((m) => isLiveMatch(m.state)) ?? [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
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
      {items !== null ? (
        <BotSearchAction
          autoStart={autoRoam && liveItems.length === 0}
          botName={botName}
          targets={liveItems.map((m) => ({ id: m.id, band: m.band }))}
          onSelectTarget={(id) => {
            const match = liveItems.find((m) => m.id === id);
            if (!match) return;
            const href = matchHref(match);
            if (href !== "/matches") router.push(href);
          }}
        />
      ) : null}
      <div style={{ display: "grid", gap: 12 }}>
        {liveItems.map((m) => (
          <MatchCard
            key={m.id}
            peerName={m.peer?.displayName ?? "Someone"}
            band={m.band}
            reasons={m.reasons}
            photoUrl={m.peer?.photoUrl}
            onOpen={() => {
              const href = matchHref(m);
              if (href !== "/matches") router.push(href);
            }}
          />
        ))}
      </div>
    </div>
  );
}
