import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export function localInputToUtc(localDateTime: string, timezone: string) {
  return fromZonedTime(localDateTime, timezone).toISOString();
}

export function formatInterviewTime(iso: string, timezone: string) {
  return formatInTimeZone(iso, timezone, "EEE, MMM d · h:mm a zzz");
}

export function getZonedDateKey(date: Date | string, timezone: string) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function relativeStartLabel(startIso: string, durationMinutes: number, now = new Date()) {
  const start = new Date(startIso).getTime();
  const end = start + durationMinutes * 60_000;
  const current = now.getTime();
  if (current >= start && current < end) return "Happening now";
  if (current >= end) return "Interview ended";
  const minutes = Math.ceil((start - current) / 60_000);
  if (minutes < 60) return `Starts in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `Starts in ${hours} hr${hours === 1 ? "" : "s"}${remainder ? ` ${remainder} min` : ""}`;
}
