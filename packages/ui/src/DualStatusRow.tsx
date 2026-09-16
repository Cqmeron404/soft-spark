"use client";

import type { InviteUserStatus } from "@soft-spark/shared";
import { tokens } from "./tokens";

export function DualStatusRow(props: {
  youName?: string;
  themName: string;
  you: InviteUserStatus;
  them: InviteUserStatus;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: 12,
        background: tokens.bg,
        borderRadius: 16,
      }}
    >
      <StatusLine who={props.youName ?? "You"} status={props.you} />
      <StatusLine who={props.themName} status={props.them} />
      <p style={{ margin: 0, color: tokens.textMuted, fontSize: 14 }}>
        {summaryCopy(props)}
      </p>
    </div>
  );
}

function StatusLine({ who, status }: { who: string; status: InviteUserStatus }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
      <span>{who}</span>
      <strong style={{ textTransform: "capitalize" }}>{status}</strong>
    </div>
  );
}

function summaryCopy(props: {
  themName: string;
  you: InviteUserStatus;
  them: InviteUserStatus;
}): string {
  if (props.you === "declined" || props.them === "declined") {
    return "This one’s closed. Your bot keeps exploring";
  }
  if (props.you === "accepted" && props.them === "accepted") {
    return "You’re both in — details locked";
  }
  if (props.you === "accepted" && props.them === "waiting") {
    return `Waiting on ${props.themName}…`;
  }
  if (props.you === "waiting" && props.them === "accepted") {
    return `${props.themName} is in — your move`;
  }
  return "Waiting on both of you…";
}
