"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BotDto } from "@soft-spark/shared";
import { PROFILE_CHIP_PRESETS } from "@soft-spark/shared";
import { SoftError } from "@soft-spark/ui";
import { OnboardWizard } from "@/components/OnboardWizard";
import { getBot, getMe, patchBot } from "@/lib/api";
import { ensureGuestSession } from "@/lib/guest-session";

export default function CreateBotPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "wizard" | "settings">("loading");
  const [bot, setBot] = useState<BotDto | null>(null);
  const [botName, setBotName] = useState("");
  const [styleTags, setStyleTags] = useState<string[]>(["Curious"]);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await ensureGuestSession();
        await getMe();
        const current = await getBot();
        setBot(current);
        setBotName(current.botDisplayName ?? current.displayName ?? "");
        setStyleTags(current.styleTags?.length ? current.styleTags : current.vibeTags.length ? current.vibeTags : ["Curious"]);
        setPaused(current.paused || current.roamStatus === "paused");
        setMode("settings");
      } catch {
        setMode("wizard");
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
      const next = await patchBot({ displayName: botName.trim(), vibeTags: styleTags, paused });
      setBot(next);
      setPaused(next.paused);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save bot");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "loading") return <p>Catching up…</p>;
  if (mode === "wizard") return <OnboardWizard />;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13, fontWeight: 600 }}>Bot settings</p>
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Edit your dating bot</h1>
      <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>
        Pause or rename. Status bands and invites stay; chat never shows.
      </p>
      <label style={{ display: "grid", gap: 6 }}>
        Bot name
        <input value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="Ember" />
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend style={{ fontWeight: 600 }}>Style</legend>
        <div className="ss-chip-row">
          {PROFILE_CHIP_PRESETS.styleTags.map((v) => {
            const on = styleTags.includes(v);
            return (
              <button
                key={v}
                type="button"
                className="ss-chip"
                aria-pressed={on}
                onClick={() => setStyleTags(on ? styleTags.filter((x) => x !== v) : [...styleTags, v])}
              >
                {v}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={paused}
          onChange={(e) => setPaused(e.target.checked)}
          style={{ width: 20, height: 20 }}
        />
        Pause roaming
      </label>
      {error ? <SoftError>{error}</SoftError> : null}
      {saved ? (
        <p style={{ margin: 0, color: "var(--ss-success)" }}>
          {bot?.displayName} is {bot?.roamStatus ?? "updated"}
        </p>
      ) : null}
      <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void save()}>
        Save bot
      </button>
    </div>
  );
}
