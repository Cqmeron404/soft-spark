"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LookingForGender, MatchDetail, MatchListItem, ProfileGender } from "@soft-spark/shared";
import { BOT_SEARCH_ETA } from "@soft-spark/shared";
import { SearchVizPanel, type SearchVizPhase } from "@soft-spark/ui";
import { getMe, searchForDate } from "@/lib/api";

const MIN_SEARCH_MS = BOT_SEARCH_ETA.typicalSeconds * 1000;

export function matchHref(match: Pick<MatchDetail, "id" | "state">): string {
  if (match.state === "invite_ready" || match.state === "invited" || match.state === "booked") {
    return `/matches/${match.id}/reveal`;
  }
  return "/matches";
}

export function BotSearchAction(props: {
  autoStart?: boolean;
  botName?: string;
  targets?: Array<Pick<MatchListItem, "id" | "band">>;
  onSelectTarget?: (id: string) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<SearchVizPhase>("idle");
  const [remaining, setRemaining] = useState<number>(BOT_SEARCH_ETA.typicalSeconds);
  const [error, setError] = useState<string | null>(null);
  const [lookingForGender, setLookingForGender] = useState<LookingForGender>("both");
  const [youGender, setYouGender] = useState<ProfileGender | string>("female");
  const timer = useRef<number | null>(null);
  const autoStarted = useRef(false);
  const liveTargets = props.targets ?? [];
  const inviteReady = liveTargets.some((m) => m.band === "invite_ready") || phase === "found";
  const displayPhase: SearchVizPhase =
    phase === "searching" || phase === "found" || phase === "empty"
      ? phase
      : liveTargets.length
        ? "searching"
        : "idle";
  const band = inviteReady
    ? "invite_ready"
    : displayPhase === "searching"
      ? "building"
      : "low";

  useEffect(() => {
    void getMe()
      .then((me) => {
        setLookingForGender(me.lookingForGender ?? me.prefs.lookingForGender ?? "both");
        setYouGender(me.gender);
      })
      .catch(() => undefined);
  }, []);

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
        router.replace("/");
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
      <SearchVizPanel
        phase={displayPhase}
        lookingForGender={lookingForGender}
        youGender={youGender}
        etaSeconds={BOT_SEARCH_ETA.typicalSeconds}
        remainingSeconds={phase === "searching" ? remaining : undefined}
        disabled={phase === "searching"}
        onSearch={() => void run()}
        botName={props.botName}
        band={band}
      />
      {error ? <p className="ss-error">{error}</p> : null}
    </div>
  );
}
