"use client";

import type { CSSProperties } from "react";
import type { InviteUserStatus } from "@soft-spark/shared";
import { dualStatusSummary } from "@soft-spark/shared";
import { tokens } from "./tokens";

export function DualStatusRow(props: {
  youName?: string;
  themName: string;
  you: InviteUserStatus;
  them: InviteUserStatus;
  expired?: boolean;
}) {
  const key = `${props.you}-${props.them}-${props.expired ? "expired" : "live"}`;
  return (
    <div
      className="ss-dual-status"
      style={{
        display: "grid",
        gap: 8,
        padding: 12,
        background: tokens.surface,
        borderRadius: 16,
      }}
    >
      <div key={key} style={{ display: "grid", gap: 8, animation: "ss-crossfade 240ms ease" }}>
        <StatusLine who={props.youName ?? "You"} status={props.you} />
        <StatusLine who={props.themName} status={props.them} />
        <p style={{ margin: 0, color: tokens.textMuted, fontSize: 14 }}>
          {dualStatusSummary({
            themName: props.themName,
            you: props.you,
            them: props.them,
            expired: props.expired,
          })}
        </p>
      </div>
    </div>
  );
}

function StatusLine({ who, status }: { who: string; status: InviteUserStatus }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14,
        color: tokens.text,
      }}
    >
      <span>{who}</span>
      <span style={{ color: tokens.textMuted }}>·</span>
      <span className="ss-status-pill" style={pillStyle(status)}>
        {status}
      </span>
    </div>
  );
}

function pillStyle(status: InviteUserStatus): CSSProperties {
  if (status === "accepted") {
    return {
      textTransform: "capitalize",
      minHeight: 24,
      padding: "2px 10px",
      borderRadius: 999,
      background: "color-mix(in srgb, #5C8A6E 28%, #FFF8F2)",
      color: tokens.text,
      border: "1px solid transparent",
    };
  }
  if (status === "declined") {
    return {
      textTransform: "capitalize",
      minHeight: 24,
      padding: "2px 10px",
      borderRadius: 999,
      background: "transparent",
      color: "#B85C4E",
      border: "1px solid #B85C4E",
    };
  }
  return {
    textTransform: "capitalize",
    minHeight: 24,
    padding: "2px 10px",
    borderRadius: 999,
    background: tokens.surface,
    color: tokens.textMuted,
    border: `1px solid ${tokens.border}`,
  };
}
