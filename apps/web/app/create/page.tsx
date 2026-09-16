"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BotDto } from "@soft-spark/shared";
import { SoftError } from "@soft-spark/ui";
import { getBot, getMe, patchBot } from "@/lib/api";
import { getAuthSession } from "@/lib/auth";
import { DEFAULT_VIBES } from "@/lib/guest";

export default function CreateBotPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [bot, setBot] = useState<BotDto | null>(null);
  const [botName, setBotName] = useState("");
  const [vibeTags, setVibeTags] = useState<string[]>(["Curious"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const session = await getAuthSession();
      if (!session?.user) {
        router.replace("/auth/sign-in");
        return;
      }
      try {
        await getMe();
        const current = await getBot();
        setBot(current);
        setBotName(current.displayName ?? "");
        setVibeTags(current.vibeTags.length ? current.vibeTags : ["Curious"]);
        setReady(true);
      } catch {
        router.replace("/onboard");
      }
    })();
  }, [router]);

  async function save() {
    setError(null);
    setSaved(false);
    if (!botName.trim()) {
      setError("Name your bot");
      return;
    }
    setBusy(true);
    try {
      const next = await patchBot({ displayName: botName.trim(), vibeTags });
      setBot(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save bot");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p>Catching up…</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13, fontWeight: 600 }}>Create bot</p>
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Name your dating bot</h1>
      <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>
        Build from scratch — this is who goes out for you.
      </p>
      <label style={{ display: "grid", gap: 6 }}>
        Bot name
        <input value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="Ember" />
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend style={{ fontWeight: 600 }}>Vibe</legend>
        <div className="ss-chip-row">
          {DEFAULT_VIBES.map((v) => {
            const on = vibeTags.includes(v);
            return (
              <button
                key={v}
                type="button"
                className="ss-chip"
                aria-pressed={on}
                onClick={() => setVibeTags(on ? vibeTags.filter((x) => x !== v) : [...vibeTags, v])}
              >
                {v}
              </button>
            );
          })}
        </div>
      </fieldset>
      {error ? <SoftError>{error}</SoftError> : null}
      {saved ? <p style={{ margin: 0, color: "var(--ss-success)" }}>{bot?.displayName} is updated</p> : null}
      <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void save()}>
        Save bot
      </button>
    </div>
  );
}
