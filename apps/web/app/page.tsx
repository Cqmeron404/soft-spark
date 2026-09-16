"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLogo, PRODUCT_NAME, TAGLINE } from "@soft-spark/ui";
import { getMe } from "@/lib/api";
import { getAuthSession } from "@/lib/auth";
import { writeSession } from "@/lib/session";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "landing">("loading");

  useEffect(() => {
    void (async () => {
      const session = await getAuthSession();
      if (!session?.user) {
        setMode("landing");
        return;
      }
      try {
        const me = await getMe();
        writeSession({ id: me.id, displayName: me.displayName });
        router.replace("/matches");
      } catch {
        router.replace("/onboard");
      }
    })();
  }, [router]);

  if (mode !== "landing") {
    return <p style={{ color: "var(--ss-text-muted)" }}>Catching up…</p>;
  }

  return (
    <div style={{ display: "grid", gap: 24, paddingTop: 12 }}>
      <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
        <AppLogo variant="wordmark" size={88} />
        <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 32, margin: 0, lineHeight: 1.15 }}>
          {TAGLINE}
        </h1>
        <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 16, lineHeight: 1.4 }}>
          Blind dates, agent-matched. Status only until both of you accept the same invite.
        </p>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/auth/sign-up" className="ss-btn ss-btn-primary" style={{ display: "inline-flex", alignItems: "center" }}>
          Get started
        </Link>
        <Link href="/auth/sign-in" className="ss-btn ss-btn-ghost" style={{ display: "inline-flex", alignItems: "center" }}>
          Sign in
        </Link>
      </div>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 14 }}>
        No swipe. No peeking at agent chat. Both sides must accept.
      </p>
      <footer style={{ color: "var(--ss-text-muted)", fontSize: 13 }}>{PRODUCT_NAME}</footer>
    </div>
  );
}
