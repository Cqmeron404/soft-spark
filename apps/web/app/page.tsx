"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BotDto, UserDto } from "@soft-spark/shared";
import { TAGLINE } from "@soft-spark/ui";
import { WelcomeLanding } from "@/components/WelcomeLanding";
import { getAuthSession } from "@/lib/auth";
import { getBot, getMe } from "@/lib/api";
import { writeSession } from "@/lib/session";

export default function Home() {
  const [mode, setMode] = useState<"loading" | "welcome" | "home">("loading");
  const [me, setMe] = useState<UserDto | null>(null);
  const [bot, setBot] = useState<BotDto | null>(null);

  useEffect(() => {
    void (async () => {
      const signedOut = new URLSearchParams(window.location.search).get("out") === "1";
      if (signedOut) {
        setMode("welcome");
        return;
      }
      const session = await getAuthSession();
      if (!session?.user) {
        setMode("welcome");
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
        window.location.replace("/onboard");
      }
    })();
  }, []);

  if (mode === "loading") {
    return <p style={{ color: "var(--ss-text-muted)" }}>Catching up…</p>;
  }

  if (mode === "welcome" || !me) {
    return <WelcomeLanding />;
  }

  const botName = bot?.botDisplayName?.trim() || bot?.displayName?.trim() || `${me.displayName}'s bot`;
  const published = Boolean(bot?.publishedAt);
  const roaming = bot?.roamStatus === "roaming";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
        <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13, fontWeight: 600 }}>Home</p>
        <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>
          Hey, {me.displayName}
        </h1>
        <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45 }}>
          {TAGLINE}
        </p>
        <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45 }}>
          {roaming
            ? `${botName} is roaming.`
            : published
              ? `${botName} is paused.`
              : `Finish setup so ${botName} can go out.`}
        </p>
      </div>
      <div className="ss-card" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontFamily: "var(--ss-font-display)", fontSize: 22 }}>{botName}</p>
        <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 14 }}>
          {bot?.roamStatus === "roaming" ? "Roaming" : bot?.roamStatus === "paused" ? "Paused" : "Draft"}
        </p>
        {bot?.vibeLine ? (
          <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>{bot.vibeLine}</p>
        ) : null}
        <div className="ss-chip-row">
          {(bot?.styleTags ?? bot?.vibeTags ?? []).map((tag) => (
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
          Bot settings
        </Link>
        <Link href="/profile" className="ss-btn ss-btn-ghost">
          Edit profile
        </Link>
      </div>
    </div>
  );
}
