"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchDetail } from "@soft-spark/shared";
import { BOT_SEARCH_ETA } from "@soft-spark/shared";
import { BotSearchCard, type BotSearchPhase } from "@soft-spark/ui";
import { searchForDate } from "@/lib/api";

const MIN_SEARCH_MS = BOT_SEARCH_ETA.typicalSeconds * 1000;

export function matchHref(match: MatchDetail): string {
  if (match.state === "invite_ready" || match.state === "invited" || match.state === "booked") {
    return `/matches/${match.id}/reveal`;
  }
  return "/matches";
}

export function BotSearchAction(props: { autoStart?: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<BotSearchPhase>("idle");
  const [remaining, setRemaining] = useState<number>(BOT_SEARCH_ETA.typicalSeconds);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!props.autoStart || autoStarted.current) return;
    autoStarted.current = true;
    void run();
    // Start once when arriving from publish → roam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoStart]);

  async function run() {
    setError(null);
    setPhase("searching");
    setRemaining(BOT_SEARCH_ETA.typicalSeconds);
    const started = Date.now();
    timer.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setRemaining(Math.max(0, BOT_SEARCH_ETA.typicalSeconds - elapsed));
    }, 250);

    try {
      const result = await searchForDate();
      const wait = Math.max(0, MIN_SEARCH_MS - (Date.now() - started));
      if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
      if (result.found && result.match) {
        setPhase("found");
        setRemaining(0);
        router.push(matchHref(result.match));
        return;
      }
      setPhase("empty");
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        router.replace("/auth/sign-in");
        return;
      }
      setPhase("empty");
      setError(err instanceof Error ? err.message : "Search paused — try again");
    } finally {
      if (timer.current) window.clearInterval(timer.current);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <BotSearchCard
        phase={phase}
        etaSeconds={BOT_SEARCH_ETA.typicalSeconds}
        remainingSeconds={remaining}
        disabled={phase === "searching"}
        onSearch={() => void run()}
      />
      {error ? <p className="ss-error">{error}</p> : null}
    </div>
  );
}
