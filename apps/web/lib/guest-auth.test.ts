import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveGuestAuth } from "./guest-auth";
import { ROAM_HREF, tabIsCurrent, tabPath } from "./nav";

test("ensureGuest keeps a Bearer session instead of minting a new guest", () => {
  const kept = resolveGuestAuth({
    sessionUser: null,
    bearerToken: "session.token",
    localUser: { id: "user_published", displayName: "Maya" },
    fallbackName: "You",
  });
  assert.equal(kept.action, "keep");
  if (kept.action === "keep") {
    assert.equal(kept.user.id, "user_published");
    assert.equal(kept.user.name, "Maya");
  }
});

test("ensureGuest keeps cookie session even without Bearer", () => {
  const kept = resolveGuestAuth({
    sessionUser: { id: "auth_1", name: "Jordan" },
    bearerToken: null,
  });
  assert.equal(kept.action, "keep");
  if (kept.action === "keep") assert.equal(kept.user.id, "auth_1");
});

test("ensureGuest mints only when there is no session and no Bearer", () => {
  const minted = resolveGuestAuth({ sessionUser: null, bearerToken: null });
  assert.equal(minted.action, "mint");
});

test("ensureGuest replace still mints (sign-out / Get started)", () => {
  const minted = resolveGuestAuth({
    replace: true,
    sessionUser: { id: "old" },
    bearerToken: "stale",
  });
  assert.equal(minted.action, "mint");
});

test("Nav Roam goes to /matches?roam=1 and stays current on the matches route", () => {
  assert.equal(ROAM_HREF, "/matches?roam=1");
  assert.equal(tabPath(ROAM_HREF), "/matches");
  assert.equal(tabIsCurrent("/matches", ROAM_HREF), true);
  assert.equal(tabIsCurrent("/matches/abc/reveal", ROAM_HREF), true);
  assert.equal(tabIsCurrent("/", ROAM_HREF), false);
  assert.equal(tabIsCurrent("/", "/"), true);
});
