"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PreferredAction } from "@soft-spark/shared";
import { SoftError } from "@soft-spark/ui";
import { publishBot } from "@/lib/api";

export function PublishActions(props: { botName?: string; onPublished?: (action: PreferredAction) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<PreferredAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = props.botName?.trim() || "your bot";

  async function choose(action: PreferredAction) {
    setError(null);
    setBusy(action);
    try {
      await publishBot(action);
      props.onPublished?.(action);
      if (action === "roam") router.push("/matches?roam=1");
      else router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ fontFamily: "var(--ss-font-display)", fontSize: 26, margin: 0 }}>
        Publish {label}
      </h2>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45 }}>
        After this, people only see status bands and invites — never bot chat.
      </p>
      {error ? <SoftError>{error}</SoftError> : null}
      <button
        type="button"
        className="ss-btn ss-btn-primary ss-action-card"
        disabled={busy !== null}
        onClick={() => void choose("roam")}
      >
        <span style={{ fontFamily: "var(--ss-font-display)", fontSize: 20 }}>Roam / find a match</span>
        <span style={{ fontWeight: 500, fontSize: 14 }}>
          Send {label} out to search for a blind date.
        </span>
      </button>
      <button
        type="button"
        className="ss-btn ss-btn-ghost ss-action-card"
        style={{ border: "1px solid var(--ss-border)", background: "var(--ss-surface)" }}
        disabled={busy !== null}
        onClick={() => void choose("wait")}
      >
        <span style={{ fontFamily: "var(--ss-font-display)", fontSize: 20 }}>Wait</span>
        <span style={{ fontWeight: 500, fontSize: 14, color: "var(--ss-text-muted)" }}>
          Keep {label} ready. You can roam anytime from the Roam tab.
        </span>
      </button>
    </div>
  );
}
