"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLogo, SoftError } from "@soft-spark/ui";
import { DemoSignInButtons } from "@/components/DemoSignInButtons";
import { signUpEmail } from "@/lib/auth";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Add email and password");
      return;
    }
    setBusy(true);
    try {
      await signUpEmail({ email: email.trim(), password, name: name.trim() || "You" });
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
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Create account</h1>
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
      <label style={{ display: "grid", gap: 6 }}>
        Name (optional)
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      {error ? <SoftError>{error}</SoftError> : null}
      <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void submit()}>
        Continue
      </button>
      <DemoSignInButtons
        busy={busy}
        onBusy={setBusy}
        onError={(m) => setError(m || null)}
        then={(path) => window.location.assign(path)}
      />
      <p style={{ margin: 0 }}>
        Already have an account? <Link href="/auth/sign-in">Log in</Link>
      </p>
    </div>
  );
}
