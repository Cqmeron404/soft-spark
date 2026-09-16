"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLogo, SoftError } from "@soft-spark/ui";
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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AppLogo variant="wordmark" size={40} />
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
          onClick={() => {
            setEmail("maya@softspark.dev");
            setPassword("spark-demo-maya");
          }}
        >
          Maya demo
        </button>
        <button
          type="button"
          className="ss-btn ss-btn-ghost"
          onClick={() => {
            setEmail("jordan@softspark.dev");
            setPassword("spark-demo-jordan");
          }}
        >
          Jordan demo
        </button>
      </div>
    </div>
  );
}
