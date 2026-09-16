"use client";

import type { InviteUserStatus, PriceTier } from "@soft-spark/shared";
import { formatMilesFromKm, inviteIsBooked, inviteIsClosed } from "@soft-spark/shared";
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
  expired?: boolean;
  youCarryCue?: string;
  themCarryCue?: string;
  carryCueDraft?: string;
  onCarryCueChange?: (value: string) => void;
  onAccept?: () => void;
  onPass?: () => void;
}) {
  const closed = inviteIsClosed(props.you, props.them) || Boolean(props.expired);
  const booked = inviteIsBooked(props.you, props.them);
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
        {formatMilesFromKm(props.travelKmYou)} mi from you · {formatMilesFromKm(props.travelKmThem)} mi from them
      </p>
      <p style={{ margin: 0, fontSize: 14 }}>{props.windowLabel}</p>
      {props.you === "waiting" && props.onCarryCueChange ? (
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>What I’ll be carrying</span>
          <input
            value={props.carryCueDraft ?? ""}
            onChange={(e) => props.onCarryCueChange?.(e.target.value)}
            maxLength={80}
            placeholder="red tote, blue jacket…"
            style={{
              minHeight: 44,
              border: `1px solid ${tokens.border}`,
              borderRadius: tokens.radiusButton,
              padding: "0 12px",
              background: tokens.surfaceElevated,
              color: tokens.text,
            }}
          />
          <span style={{ color: tokens.textMuted, fontSize: 13 }}>
            A small cue so you can find each other — not a chat
          </span>
        </label>
      ) : null}
      {props.youCarryCue || props.themCarryCue ? (
        <div
          style={{
            display: "grid",
            gap: 6,
            padding: 12,
            borderRadius: 14,
            background: tokens.surfaceElevated,
            border: `1px solid ${tokens.border}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted, fontWeight: 600 }}>
            How you’ll find each other
          </p>
          {props.youCarryCue ? (
            <p style={{ margin: 0, fontSize: 14 }}>You’ll be carrying: {props.youCarryCue}</p>
          ) : null}
          {props.themCarryCue ? (
            <p style={{ margin: 0, fontSize: 14 }}>
              {props.peerName} will be carrying: {props.themCarryCue}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted }}>
              Waiting on {props.peerName}’s carry cue
            </p>
          )}
        </div>
      ) : null}
      <DualStatusRow
        themName={props.peerName}
        you={props.you}
        them={props.them}
        expired={props.expired}
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
