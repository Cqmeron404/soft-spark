"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@soft-spark/ui";
import { signOut, writeToken } from "@/lib/auth";
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

  const homeHref = "/";
  const initial = current?.displayName.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <header className="ss-phone-header">
      <BrandMark href={homeHref} />
      <nav style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--ss-text-muted)" }}>
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
              id="ss-sign-out"
              className="ss-btn ss-btn-ghost"
              style={{ minHeight: 44, padding: "0 12px", fontSize: 13, zIndex: 2 }}
              onClick={() => {
                clearSession();
                writeToken(null);
                void signOut()
                  .catch(() => undefined)
                  .finally(() => {
                    window.location.assign("/onboard?new=1");
                  });
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link href="/auth/sign-in" style={{ fontSize: 13, color: "var(--ss-text-muted)" }}>
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
