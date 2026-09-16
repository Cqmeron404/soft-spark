import { CONSTANTS } from "@soft-spark/match-engine";

const DEMO_TZ = "America/Denver";

export function nextInviteWindow(timeZone = DEMO_TZ): {
  start: string;
  end: string;
  label: string;
  timeZone: string;
} {
  const now = new Date();
  let date = denverYmd(now, timeZone);
  for (let i = 0; i < 8; i++) {
    const dow = weekdayShort(date, timeZone);
    if ((CONSTANTS.INVITE_WINDOW.days as readonly string[]).includes(dow)) {
      const start = `${date}T18:00:00`;
      const end = `${date}T20:00:00`;
      return {
        start: zonedIso(start, timeZone),
        end: zonedIso(end, timeZone),
        label: `${dow} 18:00–20:00 · ${timeZone}`,
        timeZone,
      };
    }
    date = addDays(date, 1);
  }
  return {
    start: now.toISOString(),
    end: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    label: "Fri–Sun 18:00–20:00 · America/Denver",
    timeZone,
  };
}

function denverYmd(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts;
}

function weekdayShort(ymd: string, timeZone: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, 18, 0));
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(utcGuess);
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function zonedIso(local: string, timeZone: string): string {
  if (timeZone === "America/Denver") return `${local}-06:00`;
  return new Date(local).toISOString();
}
