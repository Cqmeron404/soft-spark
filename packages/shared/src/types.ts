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

/** Spark lock: relationship intent. Do not overload with gender. */
export type Intent = LookingFor;

/** Spark lock: profile gender is binary for v1 matching + graph colors. */
export type ProfileGender = "male" | "female";

/** Spark lock: who the bot may hop toward. */
export type LookingForGender = "male" | "female" | "both";

/** After publish, roam starts stub search; wait keeps the bot ready. */
export type PreferredAction = "roam" | "wait";

/** Spark lock: draft until publish; roaming while searching; paused when wait/paused. */
export type RoamStatus = "draft" | "roaming" | "paused";
