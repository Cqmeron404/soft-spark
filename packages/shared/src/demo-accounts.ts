import type { OnboardBody } from "./dto";

/**
 * Public one-tap demo credentials (web /auth/sign-in) and matching onboard
 * personas. Keep UI buttons, API ensure-demo-users, and soak in lockstep.
 */
export const DEMO_ACCOUNTS = {
  maya: {
    email: "maya@softspark.dev",
    password: "spark-demo-maya",
    name: "Maya",
  },
  jordan: {
    email: "jordan@softspark.dev",
    password: "spark-demo-jordan",
    name: "Jordan",
  },
} as const;

export type DemoAccountId = keyof typeof DEMO_ACCOUNTS;
export type DemoAccount = (typeof DEMO_ACCOUNTS)[DemoAccountId];

export const DEMO_ONBOARD = {
  maya: {
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
    photoUrl: "https://cdn.softspark.dev/maya.jpg",
  },
  jordan: {
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
  },
} satisfies Record<DemoAccountId, OnboardBody>;

export const DEMO_PERSONAS = [
  { id: "maya" as const, account: DEMO_ACCOUNTS.maya, onboard: DEMO_ONBOARD.maya },
  { id: "jordan" as const, account: DEMO_ACCOUNTS.jordan, onboard: DEMO_ONBOARD.jordan },
];
