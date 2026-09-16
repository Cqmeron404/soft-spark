/** Canonical Forge event names from forge-contract-v0. */
export const EVENTS = {
  BOT_TURN_REQUESTED: "bot.turn.requested",
  BOT_TURN_COMPLETED: "bot.turn.completed",
  MATCH_SCORE_UPDATED: "match.score.updated",
  MATCH_INVITE_READY: "match.invite_ready",
  MATCH_VENUE_UNAVAILABLE: "match.venue_unavailable",
  MATCH_SAFETY_FAILED: "match.safety_failed",
  MATCH_ARCHIVED: "match.archived",
  INVITE_SENT: "invite.sent",
  INVITE_ACCEPTED: "invite.accepted",
  INVITE_DECLINED: "invite.declined",
  INVITE_BOOKED: "invite.booked",
  BOT_TURN_FALLBACK: "bot.turn.fallback",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export type DomainEvent = {
  type: EventName;
  payload: Record<string, unknown>;
  at: string;
};
