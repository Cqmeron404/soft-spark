import { getAuthSession, readToken, signOut, signUpEmail, type AuthUser } from "@/lib/auth";
import { resolveGuestAuth } from "@/lib/guest-auth";
import { guestCredentials } from "@/lib/guest";
import { readSession, writeSession } from "@/lib/session";

/** Silent guest auth so create-bot is the first screen, not a login gate. */
export async function ensureGuestSession(
  name = "You",
  opts?: { replace?: boolean }
): Promise<{ user: AuthUser }> {
  if (opts?.replace) {
    await signOut().catch(() => undefined);
  } else {
    const existing = await getAuthSession();
    const plan = resolveGuestAuth({
      sessionUser: existing?.user ?? null,
      bearerToken: readToken(),
      localUser: readSession(),
      fallbackName: name,
    });
    if (plan.action === "keep") return { user: plan.user };
  }
  const created = await signUpEmail(guestCredentials(name));
  writeSession({ id: created.user.id, displayName: created.user.name ?? name });
  return { user: created.user };
}
