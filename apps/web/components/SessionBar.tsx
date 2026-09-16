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

  const authPage = pathname.startsWith("/auth/") || pathname === "/signin" || pathname === "/signup";
  const homeHref = current ? "/" : "/";
  const initial = current?.displayName.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <header className="ss-phone-header">
      <BrandMark href={homeHref} />
      <nav style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--ss-text-muted)" }}>
        {!authPage && !current ? <Link href="/auth/sign-in">Sign in</Link> : null}
        {current ? (
          <>
            <span
              aria-hidden
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: "var(--ss-accent)",
                color: "var(--ss-text)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {initial}
            </span>
            <button
              type="button"
              className="ss-btn ss-btn-ghost"
              style={{ minHeight: 32, padding: "0 10px", fontSize: 13 }}
              onClick={async () => {
                await signOut();
                clearSession();
                window.location.href = "/auth/sign-in";
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
