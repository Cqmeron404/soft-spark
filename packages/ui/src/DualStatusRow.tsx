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
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, alignItems: "center" }}>
      <span>{who}</span>
      <strong
        className="ss-status-pill"
        style={{
          textTransform: "capitalize",
          minHeight: 24,
          padding: "2px 10px",
          borderRadius: 999,
          background: status === "accepted" ? tokens.accentSoft : status === "declined" ? `${tokens.danger}22` : tokens.surface,
          color: status === "declined" ? tokens.danger : tokens.text,
        }}
      >
        {status}
      </strong>
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
