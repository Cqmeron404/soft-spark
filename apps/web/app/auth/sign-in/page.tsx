"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLogo, SoftError } from "@soft-spark/ui";
import { DemoSignInButtons } from "@/components/DemoSignInButtons";
import { getMe } from "@/lib/api";
import { signInEmail } from "@/lib/auth";
import { writeSession } from "@/lib/session";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signInEmail({ email, password });
      try {
        const me = await getMe();
        writeSession({ id: me.id, displayName: me.displayName });
        router.replace("/");
      } catch {
        router.replace("/onboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in to keep your bot dating");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AppLogo variant="wordmark" size={64} />
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Welcome back</h1>
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
      <DemoSignInButtons busy={busy} onBusy={setBusy} onError={(m) => setError(m || null)} then={(path) => router.replace(path)} />
      <p style={{ margin: 0 }}>
        New here? <Link href="/auth/sign-up">Create your bot</Link>
      </p>
    </div>
  );
}
