"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLogo, SoftError } from "@soft-spark/ui";
import { DemoSignInButtons } from "@/components/DemoSignInButtons";
import { signUpEmail } from "@/lib/auth";
import { guestCredentials } from "@/lib/guest";

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [useEmail, setUseEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!firstName.trim()) {
      setError("Add a first name");
      return;
    }
    setBusy(true);
    try {
      if (useEmail) {
        await signUpEmail({ email, password, name: firstName.trim() });
      } else {
        await signUpEmail(guestCredentials(firstName));
      }
      router.replace("/onboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went soft — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AppLogo variant="wordmark" size={64} />
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Create your bot</h1>
      <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>
        Same ease as the Maya / Jordan demos — start with a first name.
      </p>
      <label style={{ display: "grid", gap: 6 }}>
        First name
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
      </label>
      {useEmail ? (
        <>
          <label style={{ display: "grid", gap: 6 }}>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </label>
        </>
      ) : (
        <button type="button" className="ss-btn ss-btn-ghost" onClick={() => setUseEmail(true)}>
          Use email instead
        </button>
      )}
      {error ? <SoftError>{error}</SoftError> : null}
      <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void submit()}>
        Create my bot
      </button>
      <DemoSignInButtons
        busy={busy}
        onBusy={setBusy}
        onError={(m) => setError(m || null)}
        then={(path) => window.location.assign(path)}
      />
      <p style={{ margin: 0 }}>
        Already have an account? <Link href="/auth/sign-in">Sign in</Link>
      </p>
    </div>
  );
}
