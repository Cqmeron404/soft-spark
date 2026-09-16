export type MatchState =
  | "exploring"
  | "invite_ready"
  | "invited"
  | "booked"
  | "declined"
  | "archived";

/** UX only — never send raw confidence to clients. */
export type ConfidenceBand = "low" | "building" | "strong" | "invite_ready";

export type InviteUserStatus = "waiting" | "accepted" | "declined";

export type InviteStatus = "pending" | "booked" | "declined";

export type Geo = { lat: number; lng: number };

export type PriceTier = 1 | 2 | 3 | 4;

export type LookingFor = "relationship" | "casual" | "unsure";
