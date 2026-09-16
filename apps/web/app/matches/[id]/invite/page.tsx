"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { MatchDetail } from "@soft-spark/shared";
import { ConnectingCaption, InviteCard } from "@soft-spark/ui";
import { acceptInvite, declineInvite, getMatch } from "@/lib/api";
import { useMatchRealtime } from "@/lib/realtime";
import { readSession } from "@/lib/session";

export default function InvitePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const session = readSession();
    if (!session) {
      router.replace("/auth/sign-in");
      return;
    }
    setMatch(await getMatch(params.id));
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  const live = useMatchRealtime((event) => {
    if (event.matchId !== params.id || !event.invite || !match) return;
    const isA = true;
    void getMatch(params.id).then(setMatch);
    void isA;
  });

  if (!match) return <p>Catching up…</p>;
  if (!match.invite) {
    return <p>No invite yet — still exploring.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ConnectingCaption live={live} />
      {error ? <p className="ss-error">{error}</p> : null}
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
          try {
            setMatch(await acceptInvite(match.id, match.invite!.id));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Accept failed");
          }
        }}
        onPass={async () => {
          try {
            setMatch(await declineInvite(match.id, match.invite!.id));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Decline failed");
          }
        }}
      />
    </div>
  );
}
