"use client";

import type { InviteUserStatus, PriceTier } from "@soft-spark/shared";
import { tokens } from "./tokens";
import { DualStatusRow } from "./DualStatusRow";

export function priceLabel(tier: PriceTier): string {
  return "$".repeat(tier);
}

export function InviteCard(props: {
  venueName: string;
  cuisine: string;
  priceTier: PriceTier;
  travelKmYou: number;
  travelKmThem: number;
  windowLabel: string;
  neighborhood: string;
  peerName: string;
  you: InviteUserStatus;
  them: InviteUserStatus;
  onAccept?: () => void;
  onPass?: () => void;
}) {
  const closed = props.you === "declined" || props.them === "declined";
  const booked = props.you === "accepted" && props.them === "accepted";
  return (
    <article
      style={{
        background: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: tokens.radiusCard,
        padding: 20,
        display: "grid",
        gap: 12,
      }}
    >
      <p style={{ margin: 0, color: tokens.textMuted, fontSize: 13 }}>
        Midway between you two — one place, both invited
      </p>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{props.venueName}</h2>
      <p style={{ margin: 0, color: tokens.textMuted }}>
        {props.cuisine} · {priceLabel(props.priceTier)} · {props.neighborhood}
      </p>
      <p style={{ margin: 0, fontSize: 14 }}>
        {props.travelKmYou.toFixed(1)} km from you · {props.travelKmThem.toFixed(1)} km from them
      </p>
      <p style={{ margin: 0, fontSize: 14 }}>{props.windowLabel}</p>
      <DualStatusRow
        themName={props.peerName}
        you={props.you}
        them={props.them}
      />
      {!closed && !booked && props.you === "waiting" ? (
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <button
            type="button"
            className="ss-btn ss-btn-primary"
            onClick={props.onAccept}
            style={{
              flex: 1,
              minHeight: 44,
              border: "none",
              borderRadius: tokens.radiusButton,
              background: tokens.accent,
              color: tokens.text,
              fontWeight: 600,
            }}
          >
            I’m in
          </button>
          <button
            type="button"
            onClick={props.onPass}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: tokens.radiusButton,
              background: "transparent",
              color: tokens.danger,
              border: `1px solid ${tokens.danger}`,
              fontWeight: 600,
            }}
          >
            Pass
          </button>
        </div>
      ) : null}
    </article>
  );
}
