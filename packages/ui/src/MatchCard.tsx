"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { ConfidenceBand } from "@soft-spark/shared";
import { tokens } from "./tokens";
import { BandChip } from "./BandChip";
import { SignalLine } from "./SignalLine";

export function MatchCard(props: {
  peerName: string;
  band: ConfidenceBand;
  reasons: string[];
  photoUrl?: string;
  onOpen?: () => void;
}) {
  const [lift, setLift] = useState(false);
  useEffect(() => {
    setLift(true);
    const t = setTimeout(() => setLift(false), 420);
    return () => clearTimeout(t);
  }, [props.band, props.reasons.join("|")]);

  return (
    <button
      type="button"
      onClick={props.onOpen}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: tokens.radiusCard,
        padding: 18,
        cursor: props.onOpen ? "pointer" : "default",
        color: tokens.text,
        transform: lift ? "translateY(-4px)" : "translateY(0)",
        transition: "transform 280ms ease",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <AvatarPair label={props.peerName} photoUrl={props.photoUrl} />
        <div style={{ flex: 1, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ fontSize: 16 }}>{props.peerName}</strong>
            <BandChip band={props.band} />
          </div>
          <div key={props.reasons.join("|")} className="ss-signal-swap">
            <SignalLine reasons={props.reasons} />
          </div>
        </div>
      </div>
    </button>
  );
}

function AvatarPair({ label, photoUrl }: { label: string; photoUrl?: string }) {
  const initial = label.slice(0, 1).toUpperCase();
  return (
    <div style={{ display: "flex", width: 56 }}>
      <span style={avatarStyle(tokens.accentSoft)}>you</span>
      <span
        style={{
          ...avatarStyle(tokens.accent),
          marginLeft: -10,
          backgroundImage: photoUrl ? `url(${photoUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {photoUrl ? "" : initial}
      </span>
    </div>
  );
}

function avatarStyle(bg: string): CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: bg,
    color: tokens.text,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 600,
    border: `2px solid ${tokens.surface}`,
  };
}
