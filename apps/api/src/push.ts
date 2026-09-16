import {
  isClientPushType,
  pushCopy,
  type ClientPushPayload,
  type ClientRealtimeEvent,
} from "@soft-spark/shared";
import { envFlags } from "./env.js";
import type { PushDeviceRecord, SparkStore } from "./store.js";

export type PushSender = {
  sendWeb(device: PushDeviceRecord, payload: ClientPushPayload): Promise<void>;
  sendExpo(device: PushDeviceRecord, payload: ClientPushPayload): Promise<void>;
};

export type PushDispatcher = {
  notify(userIds: string[], event: ClientRealtimeEvent): Promise<ClientPushPayload | null>;
  configured: () => { web: boolean; expo: boolean };
};

function statusPayload(event: ClientRealtimeEvent): ClientPushPayload | null {
  if (!isClientPushType(event.type)) return null;
  const copy = pushCopy(event.type, event.band);
  const payload: ClientPushPayload = {
    type: event.type,
    matchId: event.matchId,
    state: event.state,
    band: event.band,
    title: copy.title,
    body: copy.body,
  };
  const json = JSON.stringify(payload);
  if (json.includes('"confidence"') || json.includes("transcript") || /"messages"\s*:/.test(json)) {
    throw new Error("push payload leaked confidence, transcript, or messages[]");
  }
  return payload;
}

/** Stub sender when VAPID / network is missing — records in-memory for tests. */
export function createMemoryPushSender(log: ClientPushPayload[] = []): PushSender {
  return {
    async sendWeb(_device, payload) {
      log.push(payload);
    },
    async sendExpo(_device, payload) {
      log.push(payload);
    },
  };
}

export function createHttpPushSender(): PushSender {
  return {
    async sendWeb(device, payload) {
      const flags = envFlags();
      if (!flags.webPush || !device.endpoint || !device.p256dh || !device.auth) return;
      const webpush = await import("web-push").catch(() => null);
      if (!webpush) {
        console.warn("push skipped: web-push package unavailable");
        return;
      }
      webpush.default.setVapidDetails(
        process.env.VAPID_SUBJECT ?? "mailto:ops@softspark.dev",
        process.env.VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      );
      await webpush.default.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        JSON.stringify(payload)
      );
    },
    async sendExpo(device, payload) {
      if (!device.expoToken) return;
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (process.env.EXPO_ACCESS_TOKEN) {
        headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
      }
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify({
          to: device.expoToken,
          title: payload.title,
          body: payload.body,
          sound: "default",
          data: {
            type: payload.type,
            matchId: payload.matchId,
            state: payload.state,
            band: payload.band,
          },
        }),
      }).catch(() => {
        /* local/demo still works without Expo */
      });
    },
  };
}

export function createPushDispatcher(
  store: SparkStore,
  sender: PushSender = createHttpPushSender()
): PushDispatcher {
  return {
    configured: () => {
      const flags = envFlags();
      return { web: flags.webPush, expo: true };
    },
    async notify(userIds, event) {
      const payload = statusPayload(event);
      if (!payload) return null;
      for (const userId of userIds) {
        const devices = await store.listPushDevices(userId);
        for (const device of devices) {
          try {
            if (device.platform === "expo") await sender.sendExpo(device, payload);
            else await sender.sendWeb(device, payload);
          } catch (err) {
            console.warn("push send failed", device.platform, err instanceof Error ? err.message : err);
          }
        }
      }
      return payload;
    },
  };
}
