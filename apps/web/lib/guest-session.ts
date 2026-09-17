import { getAuthSession, signOut, signUpEmail, type AuthUser } from "@/lib/auth";
import { guestCredentials } from "@/lib/guest";
import { writeSession } from "@/lib/session";

/** Silent guest auth so create-bot is the first screen, not a login gate. */
export async function ensureGuestSession(
  name = "You",
  opts?: { replace?: boolean }
): Promise<{ user: AuthUser }> {
  if (opts?.replace) {
    await signOut().catch(() => undefined);
  } else {
    const existing = await getAuthSession();
    if (existing?.user) return existing;
  }
  const created = await signUpEmail(guestCredentials(name));
  writeSession({ id: created.user.id, displayName: created.user.name ?? name });
  return { user: created.user };
}
