/** Demo-style first-name signup — no email form required. */
export function guestCredentials(firstName: string) {
  const slug = firstName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "spark";
  const suffix = Math.random().toString(36).slice(2, 6);
  return {
    name: firstName.trim() || "Spark",
    email: `${slug}.${suffix}@guest.softspark.dev`,
    password: `spark-${slug}-${suffix}`,
  };
}

export const DENVER_HOME = { lat: 39.739, lng: -104.979 } as const;
export const DEFAULT_VIBES = ["Curious", "Bold", "Soft", "Witty"] as const;
export const GENDER_OPTIONS = ["woman", "man", "nonbinary"] as const;
export const LOOKING_OPTIONS = [
  { id: "relationship", label: "Relationship" },
  { id: "casual", label: "Casual" },
  { id: "unsure", label: "Still figuring it out" },
] as const;
