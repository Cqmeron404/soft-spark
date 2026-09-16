"use client";

import { BOT_SEARCH_ETA } from "@soft-spark/shared";
import { AppLogo } from "./AppLogo";

export type BotSearchPhase = "idle" | "searching" | "found" | "empty";

const SEARCH_LINES = [
  "Your bot is looking nearby…",
  "Checking chemistry, softly…",
  "Finding a midway spot…",
  "Almost ready to invite you…",
] as const;

export function searchLineForElapsed(elapsedSeconds: number): string {
  if (elapsedSeconds < 4) return SEARCH_LINES[0];
  if (elapsedSeconds < 8) return SEARCH_LINES[1];
  if (elapsedSeconds < 13) return SEARCH_LINES[2];
  return SEARCH_LINES[3];
}

export function BotSearchCard(props: {
  phase: BotSearchPhase;
  etaSeconds?: number;
  remainingSeconds?: number;
  onSearch?: () => void;
  disabled?: boolean;
}) {
  const eta = props.etaSeconds ?? BOT_SEARCH_ETA.typicalSeconds;
  const remaining = Math.max(0, props.remainingSeconds ?? eta);
  const elapsed = Math.max(0, eta - remaining);
  const searching = props.phase === "searching";

  return (
    <div className="ss-card" style={{ display: "grid", gap: 14, justifyItems: "start" }}>
      {searching ? (
        <div className="ss-ember-search" aria-hidden>
          <AppLogo variant="mark" size={40} alt="" />
        </div>
      ) : null}
      <p style={{ margin: 0, fontFamily: "var(--ss-font-display)", fontSize: 22, fontWeight: 600 }}>
        {props.phase === "found"
          ? "Your bot found someone"
          : props.phase === "empty"
            ? "Still looking"
            : searching
              ? "Your bot is out"
              : "Roam / find a match"}
      </p>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45 }}>
        {props.phase === "found"
          ? "Landing you on the invite."
          : props.phase === "empty"
            ? "No date yet — your bot will keep looking. Try again in a moment."
            : searching
              ? searchLineForElapsed(elapsed)
              : "Send your bot to search for a blind date. You’ll only see a status band and an invite — never the chat."}
      </p>
      {searching ? (
        <p style={{ margin: 0, fontSize: 14, color: "var(--ss-text)" }} aria-live="polite">
          Usually {BOT_SEARCH_ETA.minSeconds}–{BOT_SEARCH_ETA.maxSeconds} seconds
          {remaining > 0 ? ` · about ${remaining}s left` : " · wrapping up…"}
        </p>
      ) : null}
      {props.phase === "idle" || props.phase === "empty" ? (
        <button
          type="button"
          className="ss-btn ss-btn-primary"
          disabled={props.disabled}
          onClick={props.onSearch}
        >
          Roam / find a match
        </button>
      ) : null}
    </div>
  );
}
