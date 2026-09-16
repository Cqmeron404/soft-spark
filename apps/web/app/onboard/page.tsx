"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardWizard } from "@/components/OnboardWizard";
import { PublishActions } from "@/components/PublishActions";
import { getBot, getMe } from "@/lib/api";
import { getAuthSession } from "@/lib/auth";

export default function OnboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [publishOnly, setPublishOnly] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const data = await getAuthSession();
      if (!data?.user) {
        router.replace("/auth/sign-in");
        return;
      }
      setName(data.user.name ?? "");
      try {
        await getMe();
        const bot = await getBot();
        if (bot.publishedAt) {
          router.replace("/");
          return;
        }
        setPublishOnly(bot.displayName ?? data.user.name ?? "your bot");
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
