import type {
  ConfidenceBand,
  InviteStatus,
  InviteUserStatus,
  MatchState,
} from "./types";

/**
 * Client realtime payloads — band/state/invite only.
 * Never include transcripts, messages[], or raw confidence.
 */
export const CLIENT_REALTIME_EVENTS = [
  "match.score.updated",
  "match.invite_ready",
  "match.venue_unavailable",
  "invite.sent",
  "invite.accepted",
  "invite.declined",
  "invite.booked",
] as const;

export type ClientRealtimeType = (typeof CLIENT_REALTIME_EVENTS)[number];

export type ClientInvitePatch = {
  id: string;
  status: InviteStatus;
  userAStatus: InviteUserStatus;
  userBStatus: InviteUserStatus;
};

export type ClientRealtimeEvent = {
  type: ClientRealtimeType;
  matchId: string;
  state: MatchState;
  band: ConfidenceBand;
  reasons: string[];
  invite?: ClientInvitePatch;
};
