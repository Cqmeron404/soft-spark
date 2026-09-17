export type GuestAuthUser = { id: string; name?: string | null; email?: string | null };

/**
 * Hobby web stores Better Auth on a Bearer token (cross-site cookies are third-party).
 * /auth/get-session may return no user even when Authorization is valid on API routes.
 * Never mint a second guest while that token is present — that clobbers Publish → roam.
 */
export function resolveGuestAuth(input: {
  replace?: boolean;
  sessionUser?: GuestAuthUser | null;
  bearerToken?: string | null;
  localUser?: { id: string; displayName?: string } | null;
  fallbackName?: string;
}): { action: "mint" } | { action: "keep"; user: GuestAuthUser } {
  if (input.replace) return { action: "mint" };
  if (input.sessionUser?.id) return { action: "keep", user: input.sessionUser };
  if (input.bearerToken) {
    return {
      action: "keep",
      user: {
        id: input.localUser?.id ?? "bearer",
        name: input.localUser?.displayName ?? input.fallbackName ?? "You",
      },
    };
  }
  return { action: "mint" };
}
