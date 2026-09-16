"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import { getAuthSession } from "@/lib/auth";
import { writeSession } from "@/lib/session";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    void (async () => {
      const session = await getAuthSession();
      if (!session?.user) {
        router.replace("/signin");
        return;
      }
      try {
        const me = await getMe();
        writeSession({ id: me.id, displayName: me.displayName });
        router.replace("/matches");
      } catch {
        router.replace("/onboard");
      }
    })();
  }, [router]);
  return <p style={{ color: "var(--ss-text-muted)" }}>Catching up…</p>;
}
