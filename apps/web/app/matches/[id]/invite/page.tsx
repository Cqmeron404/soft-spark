"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { MatchDetail } from "@soft-spark/shared";
import { InviteCard } from "@soft-spark/ui";
import { acceptInvite, declineInvite, getMatch } from "@/lib/api";
import { readSession } from "@/lib/session";

export default function InvitePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const session = readSession();
    if (!session) {
      router.replace("/onboard");
      return;
    }
    setMatch(await getMatch(session.id, params.id));
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  if (!match) return <p>Loading…</p>;
  if (!match.invite) {
    return <p>No invite yet — still exploring.</p>;
  }

  const session = readSession();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error ? <p style={{ color: "var(--ss-danger)" }}>{error}</p> : null}
      <InviteCard
        venueName={match.invite.venue.name}
        cuisine={match.invite.venue.cuisine}
        priceTier={match.invite.venue.priceTier}
        travelKmYou={match.invite.venue.travelKmYou}
        travelKmThem={match.invite.venue.travelKmThem}
        windowLabel={match.invite.window.label}
        neighborhood={match.invite.venue.approxNeighborhood}
        peerName={match.peer?.displayName ?? "Them"}
        you={match.invite.you}
        them={match.invite.them}
        onAccept={async () => {
          if (!session) return;
          try {
            setMatch(await acceptInvite(session.id, match.id, match.invite!.id));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Accept failed");
          }
        }}
        onPass={async () => {
          if (!session) return;
          try {
            setMatch(await declineInvite(session.id, match.id, match.invite!.id));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Decline failed");
          }
        }}
      />
    </div>
  );
}
