import type { OnboardBody } from "./dto";

/** Public one-tap demo credentials (also shown on the web sign-in page). */
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
    height: "5'6\"",
    hairColor: "dark brown",
    eyeColor: "brown",
    city: "Denver",
    neighborhood: "Capitol Hill",
    likes: ["pasta", "live music", "late walks"],
    dislikes: ["cigarettes", "ghosting"],
    hobbies: ["food", "hiking", "live music"],
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
  botName: "Ember",
  publish: true,
  preferredAction: "wait",
};

export const DEMO_JORDAN_ONBOARD: OnboardBody = {
  botDatingOptIn: true,
  profile: {
    displayName: "Jordan",
    age: 31,
    gender: "man",
    interestedIn: ["woman"],
    bio: "LoHi, long walks, pasta",
    height: "5'11\"",
    hairColor: "brown",
    eyeColor: "hazel",
    city: "Denver",
    neighborhood: "LoHi",
    likes: ["pasta", "design", "hiking"],
    dislikes: ["loud bars", "tardiness"],
    hobbies: ["food", "hiking", "design"],
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
  botName: "Nico",
  publish: true,
  preferredAction: "wait",
};
