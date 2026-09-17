export {
  CITY_NEIGHBORHOODS,
  DEFAULT_CITY,
  GENDER_OPTIONS,
  INTENT_OPTIONS,
  LOOKING_FOR_GENDER_OPTIONS,
  PROFILE_CHIP_PRESETS,
  TRAVEL_MILE_OPTIONS,
  geoForPlace,
} from "@soft-spark/shared";

/** Demo-style first-name signup — no email form required. */
export function guestCredentials(firstName: string) {
  const slug = firstName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "spark";
  const suffix = Math.random().toString(36).slice(2, 6);
  return {
    name: firstName.trim() || "You",
    email: `${slug}.${suffix}@guest.softspark.dev`,
    password: `spark-${slug}-${suffix}`,
  };
}

export const DENVER_HOME = { lat: 39.739, lng: -104.979 } as const;
export const DEFAULT_VIBES = ["Curious", "Bold", "Soft", "Witty"] as const;
