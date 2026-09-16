"use client";

import type { ConfidenceBand } from "@soft-spark/shared";
import { BAND_LABEL, tokens } from "./tokens";

export function BandChip({ band }: { band: ConfidenceBand }) {
  const colors = tokens.band[band];
  const glow =
    band === "invite_ready" ? `0 0 8px ${tokens.accent}4D` : "none";
  return (
    <span
      key={band}
      className="ss-band-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 28,
        padding: "0 12px",
        borderRadius: tokens.radiusChip,
        background: colors.fill,
        color: colors.text,
        fontFamily: 'Inter, "SF Pro Text", system-ui, sans-serif',
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        boxShadow: glow,
      }}
    >
      {BAND_LABEL[band]}
    </span>
  );
}
