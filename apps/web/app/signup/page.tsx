"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    setBusy(true);
    try {
      await signUpEmail({ email, password, name });
      router.replace("/onboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 32, margin: 0 }}>Join Soft spark</h1>
      <label style={{ display: "grid", gap: 6 }}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
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
      {error ? <p style={{ color: "var(--ss-danger)" }}>{error}</p> : null}
      <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void submit()}>
        Continue
      </button>
      <p style={{ margin: 0 }}>
        Already have an account? <Link href="/signin">Sign in</Link>
      </p>
    </div>
  );
}
