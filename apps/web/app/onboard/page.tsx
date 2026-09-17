"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardWizard } from "@/components/OnboardWizard";
import { PublishActions } from "@/components/PublishActions";
import { getBot, getMe } from "@/lib/api";
import { ensureGuestSession } from "@/lib/guest-session";

export default function OnboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [publishOnly, setPublishOnly] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await ensureGuestSession();
        setName(data.user.name ?? "");
      } catch {
        setReady(true);
        return;
      }
      const fresh = new URLSearchParams(window.location.search).get("new") === "1";
      try {
        await getMe();
        const bot = await getBot();
        if (fresh) {
          setReady(true);
          return;
        }
        if (bot.publishedAt) {
          router.replace("/");
          return;
        }
        setPublishOnly(bot.displayName ?? "your bot");
        setReady(true);
      } catch {
        setReady(true);
      }
    })();
  }, [router]);

  if (!ready) return <p>Catching up…</p>;
  if (publishOnly) return <PublishActions botName={publishOnly} />;
  return <OnboardWizard defaultName={name} />;
}
