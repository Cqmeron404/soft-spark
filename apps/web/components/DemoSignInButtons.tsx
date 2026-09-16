"use client";

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
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" className="ss-btn ss-btn-ghost" disabled={props.busy} onClick={() => void run(DEMO_ACCOUNTS.maya)}>
        Maya demo
      </button>
      <button
        type="button"
        className="ss-btn ss-btn-ghost"
        disabled={props.busy}
        onClick={() => void run(DEMO_ACCOUNTS.jordan)}
      >
        Jordan demo
      </button>
    </div>
  );
}