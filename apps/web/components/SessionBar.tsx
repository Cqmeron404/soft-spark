"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@soft-spark/ui";
import { signOut } from "@/lib/auth";
import { SESSION_EVENT, clearSession, readSession, type SessionUser } from "@/lib/session";

export function SessionBar() {
  const pathname = usePathname();
  const [current, setCurrent] = useState<SessionUser | null>(null);

  useEffect(() => {
    function refresh() {
      setCurrent(readSession());
    }
    refresh();
    window.addEventListener(SESSION_EVENT, refresh);
    return () => window.removeEventListener(SESSION_EVENT, refresh);
  }, [pathname]);

  const authPage = pathname === "/signin" || pathname === "/signup";

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        padding: "12px 20px",
        borderBottom: "1px solid var(--ss-border)",
      }}
    >
      <BrandMark href={current ? "/matches" : "/signin"} />
      <nav style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--ss-text-muted)" }}>
        {!authPage && !current ? <Link href="/signin">Sign in</Link> : null}
        {current ? (
          <>
            <span>{current.displayName}</span>
            <Link href="/onboard">Profile</Link>
            <button
              type="button"
              className="ss-btn ss-btn-ghost"
              style={{ minHeight: 32 }}
              onClick={async () => {
                await signOut();
                clearSession();
                window.location.href = "/signin";
              }}
            >
              Sign out
            </button>
          </>
        ) : null}
      </nav>
    </header>
  );
}
