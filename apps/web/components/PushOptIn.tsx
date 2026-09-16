"use client";

import { useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";
import { readToken } from "@/lib/auth";
import { readSession } from "@/lib/session";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushOptIn() {
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!readSession()) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    void (async () => {
      try {
        const vapid = await fetch(`${API_URL}/push/vapid-public`, {
          credentials: "include",
          headers: readToken() ? { authorization: `Bearer ${readToken()}` } : undefined,
        }).then((r) => r.json() as Promise<{ configured: boolean; publicKey: string | null }>);
        await navigator.serviceWorker.register("/sw.js");
        if (!vapid.configured || !vapid.publicKey) {
          setNote(null);
          return;
        }
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
          }));
        await api("/users/me/push", {
          method: "POST",
          body: JSON.stringify({ platform: "web", subscription: sub.toJSON() }),
        });
      } catch {
        /* push is optional until VAPID secrets exist */
      }
    })();
  }, []);

  if (!note) return null;
  return (
    <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 12 }}>{note}</p>
  );
}
