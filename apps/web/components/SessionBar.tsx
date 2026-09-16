"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SESSION_EVENT,
  readKnownUsers,
  readSession,
  writeSession,
  type SessionUser,
} from "@/lib/session";

export function SessionBar() {
  const pathname = usePathname();
  const [current, setCurrent] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<SessionUser[]>([]);

  useEffect(() => {
    function refresh() {
      setCurrent(readSession());
      setUsers(readKnownUsers());
    }
    refresh();
    window.addEventListener(SESSION_EVENT, refresh);
    return () => window.removeEventListener(SESSION_EVENT, refresh);
  }, [pathname]);

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
      <Link href="/matches" style={{ fontFamily: "var(--ss-font-display)", fontWeight: 600, color: "inherit", textDecoration: "none" }}>
        Soft spark
      </Link>
      <nav style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--ss-text-muted)" }}>
        <Link href="/onboard">Onboard</Link>
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => {
              writeSession(u);
              setCurrent(u);
              window.location.reload();
            }}
            style={{
              minHeight: 32,
              borderRadius: 999,
              border: current?.id === u.id ? "1px solid var(--ss-accent)" : "1px solid var(--ss-border)",
              background: current?.id === u.id ? "var(--ss-accent-soft)" : "transparent",
              padding: "0 10px",
              cursor: "pointer",
            }}
          >
            {u.displayName}
          </button>
        ))}
      </nav>
    </header>
  );
}
