import type { OnboardBody } from "./dto";

/** Public one-tap demo credentials shown on the web sign-in page. */
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

export const DEMO_MAYA_ONBOARD: OnboardBody = {
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
    budget: 3,
    maxTravelKm: 25,
    dealbreakers: [],
    lookingFor: "relationship",
    interests: ["food", "hiking", "live music"],
  },
  homeGeo: { lat: 39.739, lng: -104.979 },
  homeTz: "America/Denver",
  vibeTags: ["Curious", "Soft"],
  photoUrl: "https://cdn.softspark.dev/maya.jpg",
};

export const DEMO_JORDAN_ONBOARD: OnboardBody = {
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
    budget: 3,
    maxTravelKm: 20,
    dealbreakers: [],
    lookingFor: "relationship",
    interests: ["food", "hiking", "design"],
  },
  homeGeo: { lat: 39.759, lng: -104.999 },
  homeTz: "America/Denver",
  vibeTags: ["Curious", "Witty"],
};
