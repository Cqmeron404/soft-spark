"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BotDto, UserDto } from "@soft-spark/shared";
import { AppLogo, PRODUCT_NAME, SoftError, TAGLINE } from "@soft-spark/ui";
import { DemoSignInButtons } from "@/components/DemoSignInButtons";
import { getBot, getMe } from "@/lib/api";
import { getAuthSession, signUpEmail } from "@/lib/auth";
import { guestCredentials } from "@/lib/guest";
import { writeSession } from "@/lib/session";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "landing" | "home">("loading");
  const [me, setMe] = useState<UserDto | null>(null);
  const [bot, setBot] = useState<BotDto | null>(null);
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const session = await getAuthSession();
      if (!session?.user) {
        setMode("landing");
        return;
      }
      try {
        const profile = await getMe();
        writeSession({ id: profile.id, displayName: profile.displayName });
        setMe(profile);
        try {
          setBot(await getBot());
        } catch {
          setBot(null);
        }
        setMode("home");
      } catch {
        router.replace("/onboard");
      }
    })();
  }, [router]);

  async function startFromName() {
    setError(null);
    if (!firstName.trim()) {
      setError("Add a first name to create your bot");
      return;
    }
    setBusy(true);
    try {
      await signUpEmail(guestCredentials(firstName));
      router.replace("/onboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went soft — try again");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "loading") {
    return <p style={{ color: "var(--ss-text-muted)" }}>Catching up…</p>;
  }

  if (mode === "home" && me) {
    const botName = bot?.displayName?.trim() || `${me.displayName}'s bot`;
    const published = Boolean(bot?.publishedAt);
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13, fontWeight: 600 }}>Home</p>
          <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>
            Hey, {me.displayName}
          </h1>
          <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45 }}>
            {published
              ? bot?.preferredAction === "roam"
                ? `${botName} is ready to roam for a blind date.`
                : `${botName} is published and waiting — roam when you want.`
              : `Finish setup so ${botName} can go out.`}
          </p>
        </div>
        <div className="ss-card" style={{ display: "grid", gap: 10 }}>
          <p style={{ margin: 0, fontFamily: "var(--ss-font-display)", fontSize: 22 }}>{botName}</p>
          <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 14 }}>
            {published ? (bot?.preferredAction === "roam" ? "Published · roam" : "Published · wait") : "Draft"}
          </p>
          <div className="ss-chip-row">
            {(bot?.vibeTags ?? []).map((tag) => (
              <span key={tag} className="ss-chip ss-chip-on">
                {tag}
              </span>
            ))}
          </div>
        </div>
        {published ? (
          <Link href="/matches?roam=1" className="ss-btn ss-btn-primary">
            Roam / find a match
          </Link>
        ) : (
          <Link href="/onboard" className="ss-btn ss-btn-primary">
            Finish setup
          </Link>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/create" className="ss-btn ss-btn-ghost">
            Edit bot
          </Link>
          <Link href="/profile" className="ss-btn ss-btn-ghost">
            Edit profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20, paddingTop: 8 }}>
      <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
        <AppLogo variant="wordmark" size={72} />
        <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0, lineHeight: 1.15 }}>
          {TAGLINE}
        </h1>
        <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 16, lineHeight: 1.4 }}>
          Name a bot. Fill a dating profile. Publish. Then roam — status and invites only.
        </p>
      </div>
      <div className="ss-card" style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Create your bot</p>
        <label style={{ display: "grid", gap: 6 }}>
          First name
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            placeholder="Riley"
          />
        </label>
        {error ? <SoftError>{error}</SoftError> : null}
        <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void startFromName()}>
          Create my bot
        </button>
        <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13 }}>
          One tap — no email form. Or use a demo account.
        </p>
      </div>
      <DemoSignInButtons
        busy={busy}
        onBusy={setBusy}
        onError={(m) => setError(m || null)}
        then={(path) => {
          window.location.assign(path);
        }}
      />
      <p style={{ margin: 0 }}>
        <Link href="/auth/sign-in">Already have an account? Sign in</Link>
      </p>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13 }}>{PRODUCT_NAME}</p>
    </div>
  );
}
