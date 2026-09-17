/** Aura Ember tokens — cream / coral / peach / cocoa. */
export const tokens = {
  bg: "#F7F1EA",
  surface: "#FFF8F2",
  surfaceElevated: "#FFFFFF",
  text: "#2A211C",
  textMuted: "#7A6E66",
  border: "#E8DFD6",
  accent: "#E8A598",
  accentSoft: "#F0C4A8",
  danger: "#B85C4E",
  success: "#5C8A6E",
  radiusCard: 20,
  radiusChip: 999,
  radiusButton: 14,
  radiusPhone: 42,
  graph: {
    well: "#1A1614",
    female: "#E891B0",
    male: "#6BA3E8",
    you: "#F0C4A8",
    youRing: "#E8A598",
    edge: "rgba(255,248,242,0.18)",
    filtered: "#6E655E",
    hopMs: 1200,
  },
  band: {
    low: { fill: "#C4B5AB", text: "#2A211C" },
    building: { fill: "#D4A574", text: "#2A211C" },
    strong: { fill: "#E07A5F", text: "#FFFFFF" },
    invite_ready: { fill: "#C45C4A", text: "#FFFFFF" },
  },
} as const;

export const BAND_LABEL: Record<keyof typeof tokens.band, string> = {
  low: "Low",
  building: "Building",
  strong: "Strong",
  invite_ready: "Invite ready",
};
