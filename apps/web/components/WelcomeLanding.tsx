"use client";

import { useState } from "react";
import Link from "next/link";
import { AppLogo, PRODUCT_NAME, TAGLINE } from "@soft-spark/ui";
import { DemoSignInButtons } from "@/components/DemoSignInButtons";

export function WelcomeLanding() {
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ display: "grid", gap: 18, justifyItems: "start" }}>
      <AppLogo variant="mark" size={56} />
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 34, margin: 0, lineHeight: 1.15 }}>
        {PRODUCT_NAME}
      </h1>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45, fontSize: 16 }}>
        {TAGLINE}
      </p>
      <Link href="/onboard" className="ss-btn ss-btn-primary">
        Get started
      </Link>
      <ol className="ss-how-it-works">
        <li>Create bot</li>
        <li>Bots roam</li>
        <li>You show up</li>
      </ol>
      <DemoSignInButtons
        busy={busy}
        onBusy={setBusy}
        then={(path) => window.location.assign(path)}
      />
      <p style={{ margin: 0, fontSize: 14, color: "var(--ss-text-muted)" }}>
        <Link href="/auth/sign-in">Log in</Link>
        {" · "}
        <Link href="/auth/sign-up">Create account</Link>
      </p>
    </div>
  );
}
