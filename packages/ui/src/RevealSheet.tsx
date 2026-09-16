"use client";

import { tokens } from "./tokens";

export function RevealSheet(props: {
  peerName: string;
  onSeeInvite: () => void;
  onMaybeLater: () => void;
}) {
  return (
    <section
      style={{
        minHeight: "70vh",
        borderRadius: 24,
        padding: 28,
        display: "grid",
        alignContent: "center",
        gap: 16,
        background: `radial-gradient(120% 80% at 50% 0%, ${tokens.accent} 0%, ${tokens.accentSoft} 38%, ${tokens.surfaceElevated} 78%)`,
        color: tokens.text,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: "Fraunces, Georgia, serif",
          fontSize: 32,
          fontWeight: 600,
          lineHeight: 1.15,
        }}
      >
        It’s a match
      </h1>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.4 }}>
        {props.peerName} · Your bots found real chemistry
      </p>
      <button type="button" className="ss-btn ss-btn-primary" onClick={props.onSeeInvite}>
        See the invite
      </button>
      <button
        type="button"
        onClick={props.onMaybeLater}
        style={{
          minHeight: 44,
          border: "none",
          background: "transparent",
          color: tokens.text,
          fontWeight: 600,
        }}
      >
        Maybe later
      </button>
    </section>
  );
}
