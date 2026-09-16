"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchListItem } from "@soft-spark/shared";
import { MatchCard } from "@soft-spark/ui";
import { listMatches, orchestrate } from "@/lib/api";
import { readKnownUsers, readSession } from "@/lib/session";

export default function MatchesPage() {
  const router = useRouter();
  const [items, setItems] = useState<MatchListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    const session = readSession();
    if (!session) {
      router.replace("/onboard");
      return;
    }
    try {
      setItems(await listMatches(session.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function runJob() {
    setError(null);
    const session = readSession();
    const users = readKnownUsers();
    const other = users.find((u) => u.id !== session?.id);
    if (!session || !other) {
      setError("Onboard two people first (Fill Maya, then Fill Jordan).");
      return;
    }
    try {
      const result = await orchestrate(session.id, other.id);
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
      <button type="button" className="ss-btn ss-btn-primary" onClick={runJob}>
        Run match job (demo)
      </button>
      {note ? <p style={{ color: "var(--ss-text-muted)", margin: 0 }}>{note}</p> : null}
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
