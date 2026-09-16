import { EVENTS } from "@soft-spark/shared";
import { createApp } from "./app.js";
import { eventLog } from "./event-log.js";
import { createEngine, orchestrateMatch } from "./orchestrate.js";
import { store } from "./store.js";

const MAYA = {
  botDatingOptIn: true,
  profile: {
    displayName: "Maya",
    age: 29,
    gender: "woman",
    interestedIn: ["man"],
    bio: "Denver nights, italian food",
  },
  prefs: {
    cuisine: ["italian", "american"],
    budget: 3 as const,
    maxTravelKm: 25,
    dealbreakers: [],
    lookingFor: "relationship",
    interests: ["food", "hiking", "live music"],
  },
  homeGeo: { lat: 39.739, lng: -104.979 },
  homeTz: "America/Denver",
  vibeTags: ["Curious", "Soft"],
};

const JORDAN = {
  botDatingOptIn: true,
  profile: {
    displayName: "Jordan",
    age: 31,
    gender: "man",
    interestedIn: ["woman"],
    bio: "LoHi, long walks, pasta",
  },
  prefs: {
    cuisine: ["italian", "american"],
    budget: 3 as const,
    maxTravelKm: 20,
    dealbreakers: [],
    lookingFor: "relationship",
    interests: ["food", "hiking", "design"],
  },
  homeGeo: { lat: 39.759, lng: -104.999 },
  homeTz: "America/Denver",
  vibeTags: ["Curious", "Witty"],
};

type OnboardRes = { user: { id: string; displayName: string }; bot: { id: string } };
type MatchRes = {
  id: string;
  state: string;
  band: string;
  invite?: { id: string; you?: string; them?: string };
};

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function main() {
  const app = createApp();
  const failures: string[] = [];

  const noOpt = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...MAYA, botDatingOptIn: false }),
  });
  if (noOpt.status !== 400) failures.push(`opt-in expected 400, got ${noOpt.status}`);
  else console.log("ok  onboard without botDatingOptIn → 400");

  const mayaRes = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(MAYA),
  });
  const jordanRes = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(JORDAN),
  });
  if (mayaRes.status !== 201 || jordanRes.status !== 201) {
    failures.push("onboard should create User + DatingBot");
  }
  const maya = await json<OnboardRes>(mayaRes);
  const jordan = await json<OnboardRes>(jordanRes);
  if (!maya.user?.id || !maya.bot?.id) failures.push("maya missing user/bot");
  console.log("ok  onboard Maya + Jordan (User + DatingBot)");

  eventLog.clear();
  const engine = createEngine(store);
  const match = await orchestrateMatch({
    store,
    events: eventLog,
    engine,
    userAId: maya.user.id,
    userBId: jordan.user.id,
  });
  if (match.state !== "invited") {
    failures.push(`expected invited, got ${match.state} band=${match.band}`);
  } else {
    console.log(`ok  orchestrate → ${match.state} band=${match.band} reasons=${match.reasons.join(",")}`);
  }

  const required = [
    EVENTS.BOT_TURN_REQUESTED,
    EVENTS.BOT_TURN_COMPLETED,
    EVENTS.MATCH_SCORE_UPDATED,
    EVENTS.MATCH_INVITE_READY,
    EVENTS.INVITE_SENT,
  ];
  for (const name of required) {
    if (!eventLog.types().includes(name)) failures.push(`missing event ${name}`);
  }
  console.log("ok  events", eventLog.types().filter((t, i, a) => a.indexOf(t) === i).join(" · "));

  const list = await app.request("/matches", { headers: { "x-user-id": maya.user.id } });
  const matches = await json<MatchRes[]>(list);
  const raw = JSON.stringify(matches);
  if (raw.includes('"confidence"') || raw.includes("transcript") || raw.includes('"text"')) {
    failures.push("GET /matches leaked confidence or transcript");
  }
  if (!matches[0] || matches[0].state !== "invited" || !matches[0].band) {
    failures.push("GET /matches should return state + band");
  } else {
    console.log("ok  GET /matches → state + band only");
  }

  const detail = await json<MatchRes>(
    await app.request(`/matches/${match.id}`, { headers: { "x-user-id": maya.user.id } })
  );
  const inviteId = detail.invite?.id as string;
  if (!inviteId) failures.push("missing invite on match detail");

  const a1 = await app.request(`/matches/${match.id}/invites/${inviteId}/accept`, {
    method: "POST",
    headers: { "x-user-id": maya.user.id },
  });
  const afterMaya = await json<MatchRes>(a1);
  if (afterMaya.invite?.you !== "accepted" || afterMaya.state !== "invited") {
    failures.push("after Maya accept expected waiting on Jordan");
  } else console.log("ok  Maya accept → waiting on Jordan");

  const a2 = await app.request(`/matches/${match.id}/invites/${inviteId}/accept`, {
    method: "POST",
    headers: { "x-user-id": jordan.user.id },
  });
  const booked = await json<MatchRes>(a2);
  if (booked.state !== "booked") failures.push(`expected booked, got ${booked.state}`);
  else console.log("ok  dual accept → booked");

  const a3 = await app.request(`/matches/${match.id}/invites/${inviteId}/accept`, {
    method: "POST",
    headers: { "x-user-id": maya.user.id },
  });
  const again = await json<MatchRes>(a3);
  if (again.state !== "booked" || a3.status !== 200) failures.push("accept should be idempotent");
  else console.log("ok  accept is idempotent");

  if (!eventLog.types().includes(EVENTS.INVITE_ACCEPTED) || !eventLog.types().includes(EVENTS.INVITE_BOOKED)) {
    failures.push("missing invite.accepted / invite.booked");
  }

  eventLog.clear();
  const emptyEngine = createEngine(store, { emptyVenues: true });
  const kiraRes = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...MAYA,
      profile: { ...MAYA.profile, displayName: "Kira" },
    }),
  });
  const leoRes = await app.request("/users/me/onboard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...JORDAN,
      profile: { ...JORDAN.profile, displayName: "Leo" },
    }),
  });
  const kira = await json<OnboardRes>(kiraRes);
  const leo = await json<OnboardRes>(leoRes);
  const exploring = await orchestrateMatch({
    store,
    events: eventLog,
    engine: emptyEngine,
    userAId: kira.user.id,
    userBId: leo.user.id,
  });
  if (exploring.state !== "exploring") {
    failures.push(`venue_unavailable should stay exploring, got ${exploring.state}`);
  } else if (!eventLog.types().includes(EVENTS.MATCH_VENUE_UNAVAILABLE)) {
    failures.push("missing match.venue_unavailable");
  } else {
    console.log("ok  0 venues → exploring + match.venue_unavailable");
  }

  if (failures.length) {
    console.error("\nDEMO FAILED");
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log("\nSlice 1 happy path: two users → booked");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
