import type {
  ConfidenceBand,
  Geo,
  InviteStatus,
  InviteUserStatus,
  MatchState,
  PriceTier,
} from "./types";

/** Client match list/detail — band + state only, never raw confidence. */
export type PeerCard = {
  displayName: string;
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

export type BotDto = {
  id: string;
  vibeTags: string[];
  active: boolean;
  paused: boolean;
};

export type UserDto = {
  id: string;
  displayName: string;
  age: number;
  gender: string;
  interestedIn: string[];
  bio?: string;
  photoUrl?: string;
  homeGeo: Geo;
  homeTz: string;
  prefs: {
    cuisine: string[];
    budget: PriceTier;
    maxTravelKm: number;
    dealbreakers: string[];
    lookingFor: string;
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
};
