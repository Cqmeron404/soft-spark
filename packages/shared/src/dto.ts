import type {
  ConfidenceBand,
  Geo,
  Intent,
  InviteStatus,
  InviteUserStatus,
  LookingFor,
  LookingForGender,
  MatchState,
  PreferredAction,
  ProfileGender,
  RoamStatus,
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
  /** Spark look-step style tags (same list as vibeTags). */
  styleTags: string[];
  active: boolean;
  paused: boolean;
  /** User-chosen bot name. Falls back to "{displayName}'s bot" in UI if missing. */
  displayName?: string;
  botDisplayName?: string;
  vibeLine?: string;
  publishedAt?: string;
  preferredAction: PreferredAction;
  roamStatus: RoamStatus;
};

export type UserDto = {
  id: string;
  displayName: string;
  age: number;
  gender: ProfileGender | string;
  lookingForGender: LookingForGender;
  interestedIn: string[];
  bio?: string;
  photoUrl?: string;
  height?: string;
  heightCm?: number;
  hairColor?: string;
  hair?: string;
  eyeColor?: string;
  eyes?: string;
  city?: string;
  neighborhood?: string;
  likes: string[];
  dislikes: string[];
  hobbies: string[];
  botDatingOptIn: boolean;
  homeGeo: Geo;
  homeTz: string;
  prefs: {
    cuisine: string[];
    budget: PriceTier;
    maxTravelKm: number;
    maxTravelMiles: number;
    dealbreakers: string[];
    /** Spark lock: relationship | casual | unsure. Not gender. */
    intent: Intent;
    lookingForGender: LookingForGender;
    ageRangeMin?: number;
    ageRangeMax?: number;
    /** Mirror of hobbies for the existing match-engine snapshot. */
    interests: string[];
  };
};

export type OnboardBody = {
  botDatingOptIn: boolean;
  profile: {
    displayName: string;
    age: number;
    gender: string;
    lookingForGender?: LookingForGender;
    interestedIn: string[];
    bio?: string;
    height?: string;
    heightCm?: number;
    hair?: string;
    hairColor?: string;
    eyes?: string;
    eyeColor?: string;
    city?: string;
    neighborhood?: string;
    likes?: string[];
    dislikes?: string[];
    hobbies?: string[];
  };
  prefs: {
    cuisine: string[];
    budget: PriceTier;
    maxTravelKm?: number;
    maxTravelMiles?: number;
    dealbreakers: string[];
    /** Spark lock: relationship | casual | unsure. Not gender. */
    intent?: Intent | string;
    /** @deprecated Legacy onboard write for intent. Stored as intent. Never gender. */
    lookingFor?: LookingFor | string;
    lookingForGender?: LookingForGender;
    ageRangeMin?: number;
    ageRangeMax?: number;
    interests?: string[];
  };
  homeGeo?: Geo;
  homeTz?: string;
  vibeTags?: string[];
  styleTags?: string[];
  photoUrl?: string;
  /** Name the dating bot — required for a complete first-time create. */
  botName?: string;
  botDisplayName?: string;
  vibeLine?: string;
  /** If true, sets publishedAt during onboard. */
  publish?: boolean;
  preferredAction?: PreferredAction;
};

export type PublishBotBody = {
  preferredAction?: PreferredAction;
};
