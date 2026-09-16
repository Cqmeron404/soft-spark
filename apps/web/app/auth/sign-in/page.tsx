"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLogo, SoftError } from "@soft-spark/ui";
import { DEMO_ACCOUNTS } from "@soft-spark/shared";
import { getMe } from "@/lib/api";
import { signInEmail } from "@/lib/auth";
import { writeSession } from "@/lib/session";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function authenticate(nextEmail: string, nextPassword: string) {
    setError(null);
    setBusy(true);
    try {
      await signInEmail({ email: nextEmail, password: nextPassword });
      try {
        const me = await getMe();
        writeSession({ id: me.id, displayName: me.displayName });
        router.replace("/matches");
      } catch {
        router.replace("/onboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in to keep your bot dating");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    void authenticate(email, password);
  }

  function demoSignIn(account: (typeof DEMO_ACCOUNTS)["maya"]) {
    setEmail(account.email);
    setPassword(account.password);
    void authenticate(account.email, account.password);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AppLogo variant="wordmark" size={72} />
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 32, margin: 0 }}>Welcome back</h1>
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
          autoComplete="current-password"
        />
      </label>
      {error ? <SoftError>{error}</SoftError> : null}
      <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void submit()}>
        Sign in
      </button>
      <p style={{ margin: 0 }}>
        <Link href="/auth/sign-up">Create account</Link>
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="ss-btn ss-btn-ghost"
          disabled={busy}
          onClick={() => demoSignIn(DEMO_ACCOUNTS.maya)}
        >
          Demo Maya
        </button>
        <button
          type="button"
          className="ss-btn ss-btn-ghost"
          disabled={busy}
          onClick={() => demoSignIn(DEMO_ACCOUNTS.jordan)}
        >
          Demo Jordan
        </button>
      </div>
    </div>
  );
}
