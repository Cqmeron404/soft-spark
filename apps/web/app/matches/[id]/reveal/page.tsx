"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { MatchDetail } from "@soft-spark/shared";
import { RevealSheet } from "@soft-spark/ui";
import { getMatch } from "@/lib/api";
import { dismissReveal, isRevealDismissed, readSession } from "@/lib/session";

export default function RevealPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<MatchDetail | null>(null);

  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.replace("/auth/sign-in");
      return;
    }
    if (isRevealDismissed(params.id)) {
      router.replace(`/matches/${params.id}/invite`);
      return;
    }
    void getMatch(params.id).then(setMatch);
  }, [params.id, router]);

  if (!match) return <p>Loading…</p>;

  return (
    <RevealSheet
      peerName={match.peer?.displayName ?? "Someone"}
      onSeeInvite={() => router.push(`/matches/${match.id}/invite`)}
      onMaybeLater={() => {
        dismissReveal(match.id);
        router.push("/matches");
      }}
    />
  );
}
