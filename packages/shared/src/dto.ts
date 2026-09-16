import type {
  ConfidenceBand,
  Geo,
  InviteStatus,
  InviteUserStatus,
  MatchState,
  PreferredAction,
  PriceTier,
} from "./types";

/** Client match list/detail — band + state only, never raw confidence. */
export type PeerCard = {
  displayName: string;
  photoUrl?: string;
};

export type VenueCard = {
  name: string;
  cuisine: string;
  priceTier: PriceTier;
  approxNeighborhood: string;
  travelKmYou: number;
  travelKmThem: number;
  why: string;
};

export type InviteWindow = {
  start: string;
  end: string;
  label: string;
  timeZone: string;
};

export type InviteSummary = {
  id: string;
  status: InviteStatus;
  venue: VenueCard;
  window: InviteWindow;
  you: InviteUserStatus;
  them: InviteUserStatus;
  /** IRL identify cue the viewer set on accept. */
  youCarryCue?: string;
  /** IRL identify cue the peer set on accept. */
  themCarryCue?: string;
};

export type MatchListItem = {
  id: string;
  state: MatchState;
  band: ConfidenceBand;
  updatedAt: string;
  peer?: PeerCard;
  /** Snake_case Nexus codes for SignalLine (not transcripts). */
  reasons: string[];
};

export type MatchDetail = MatchListItem & {
  invite?: InviteSummary;
};

/** Authenticated stub search — never requires INTERNAL_JOB_SECRET. */
export type MatchSearchResult = {
  found: boolean;
  estimatedSeconds: number;
  match?: MatchDetail;
  message?: string;
};

export type BotDto = {
  id: string;
  vibeTags: string[];
  active: boolean;
  paused: boolean;
  /** User-chosen bot name. Falls back to "{displayName}'s bot" in UI if missing. */
  displayName?: string;
  publishedAt?: string;
  preferredAction: PreferredAction;
};

export type UserDto = {
  id: string;
  displayName: string;
  age: number;
  gender: string;
  interestedIn: string[];
  bio?: string;
  photoUrl?: string;
  height?: string;
  hairColor?: string;
  likes: string[];
  dislikes: string[];
  job?: string;
  education?: string;
  homeGeo: Geo;
  homeTz: string;
  prefs: {
    cuisine: string[];
    budget: PriceTier;
    maxTravelKm: number;
    dealbreakers: string[];
    lookingFor: string;
    /** Shown as hobbies in the dating-profile UI. */
    interests: string[];
  };
};

export type OnboardBody = {
  botDatingOptIn: boolean;
  profile: {
    displayName: string;
    age: number;
    gender: string;
    interestedIn: string[];
    bio?: string;
    height?: string;
    hairColor?: string;
    likes?: string[];
    dislikes?: string[];
    job?: string;
    education?: string;
  };
  prefs: {
    cuisine: string[];
    budget: PriceTier;
    maxTravelKm: number;
    dealbreakers: string[];
    lookingFor?: string;
    interests?: string[];
  };
  homeGeo: Geo;
  homeTz?: string;
  vibeTags?: string[];
  photoUrl?: string;
  /** Name the dating bot — required for a complete first-time create. */
  botName?: string;
  /** If true, sets publishedAt during onboard. */
  publish?: boolean;
  preferredAction?: PreferredAction;
};

export type PublishBotBody = {
  preferredAction: PreferredAction;
};
