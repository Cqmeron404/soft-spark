import type { ConfidenceBand, MatchState } from "./types";

/**
 * Status-only push (frozen A). Never include transcripts, messages[], or confidence.
 * Allowed: invite.sent / invite_ready / invite.accepted|declined / band updates.
 */
export const CLIENT_PUSH_EVENTS = [
  "match.score.updated",
  "match.invite_ready",
  "invite.sent",
  "invite.accepted",
  "invite.declined",
] as const;

export type ClientPushType = (typeof CLIENT_PUSH_EVENTS)[number];

export type ClientPushPayload = {
  type: ClientPushType;
  matchId: string;
  state: MatchState;
  band: ConfidenceBand;
  title: string;
  body: string;
};

export function isClientPushType(type: string): type is ClientPushType {
  return (CLIENT_PUSH_EVENTS as readonly string[]).includes(type);
}

export function pushCopy(type: ClientPushType, band: ConfidenceBand): { title: string; body: string } {
  switch (type) {
    case "invite.sent":
      return { title: "You’ve got an invite", body: "Same place, both of you — open it when you’re ready." };
    case "match.invite_ready":
      return { title: "Your bot found a spark", body: "An invite is ready. Status only — no chat peek." };
    case "invite.accepted":
      return { title: "Invite update", body: "Someone’s in. Check DualStatusRow for your move." };
    case "invite.declined":
      return { title: "This one’s closed", body: "Your bot keeps exploring." };
    case "match.score.updated":
      return {
        title: "Chemistry update",
        body:
          band === "invite_ready"
            ? "Invite-ready band — watch for a venue invite."
            : band === "strong"
              ? "Band moved to strong."
              : band === "building"
                ? "Band is building."
                : "Band is still low — your bot’s exploring.",
      };
  }
}
