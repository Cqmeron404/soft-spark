"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SoftError } from "@soft-spark/ui";
import { publishBot } from "@/lib/api";

export function PublishActions(props: { botName?: string; onPublished?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = props.botName?.trim() || "your bot";

  async function publish() {
    setError(null);
    setBusy(true);
    try {
      await publishBot("roam");
      props.onPublished?.();
      router.push("/matches?roam=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ fontFamily: "var(--ss-font-display)", fontSize: 26, margin: 0 }}>
        Review & publish
      </h2>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45 }}>
        Once live, your bot starts roaming for blind dates.
      </p>
      {error ? <SoftError>{error}</SoftError> : null}
      <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void publish()}>
        {busy ? "Publishing…" : "Publish bot"}
      </button>
    </div>
  );
}
