import type { InviteUserStatus } from "./types";

/** Aura DualStatusRow summary — keep web and Expo in lockstep. */
export function dualStatusSummary(props: {
  themName: string;
  you: InviteUserStatus;
  them: InviteUserStatus;
  expired?: boolean;
}): string {
  if (props.expired) return "This invite expired. Your bot keeps exploring";
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

export function inviteIsClosed(you: InviteUserStatus, them: InviteUserStatus): boolean {
  return you === "declined" || them === "declined";
}

export function inviteIsBooked(you: InviteUserStatus, them: InviteUserStatus): boolean {
  return you === "accepted" && them === "accepted";
}
