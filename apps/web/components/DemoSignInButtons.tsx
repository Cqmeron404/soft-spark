"use client";

import { useState } from "react";
import { DEMO_ACCOUNTS } from "@soft-spark/shared";
import { getMe } from "@/lib/api";
import { signInEmail } from "@/lib/auth";
import { writeSession } from "@/lib/session";

export async function signInDemo(
  account: (typeof DEMO_ACCOUNTS)[keyof typeof DEMO_ACCOUNTS],
  then: (path: string) => void
) {
  await signInEmail({ email: account.email, password: account.password });
  try {
    const me = await getMe();
    writeSession({ id: me.id, displayName: me.displayName });
    then("/");
  } catch {
    then("/onboard");
  }
}

export function DemoSignInButtons(props: {
  busy?: boolean;
  onBusy?: (busy: boolean) => void;
  onError?: (message: string) => void;
  then: (path: string) => void;
}) {
  async function run(account: (typeof DEMO_ACCOUNTS)[keyof typeof DEMO_ACCOUNTS]) {
    props.onError?.("");
    props.onBusy?.(true);
    try {
      await signInDemo(account, props.then);
    } catch (err) {
      props.onError?.(err instanceof Error ? err.message : "Sign in to keep your bot dating");
    } finally {
      props.onBusy?.(false);
    }
  }

  return (
    <div className="ss-try-as">
      <button type="button" disabled={props.busy} onClick={() => void run(DEMO_ACCOUNTS.maya)}>
        try as Maya
      </button>
      <button type="button" disabled={props.busy} onClick={() => void run(DEMO_ACCOUNTS.jordan)}>
        try as Jordan
      </button>
    </div>
  );
}

export function QuietDemoLinks() {
  const [busy, setBusy] = useState(false);
  return (
    <DemoSignInButtons
      busy={busy}
      onBusy={setBusy}
      then={(path) => window.location.assign(path)}
    />
  );
}