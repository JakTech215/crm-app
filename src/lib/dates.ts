import { format as fnsFormat } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

// ---------------------------------------------------------------------------
// Timezone constant — Central Time (CST/CDT)
// ---------------------------------------------------------------------------
export const TIMEZONE = "America/Chicago";

// ---------------------------------------------------------------------------
// "Today" in CST — returns YYYY-MM-DD string
// ---------------------------------------------------------------------------
export function todayCST(): string {
  const zoned = toZonedTime(new Date(), TIMEZONE);
  return fnsFormat(zoned, "yyyy-MM-dd");
}

// ---------------------------------------------------------------------------
// Current CST Date object (for comparisons)
// ---------------------------------------------------------------------------
export function nowCST(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

// ---------------------------------------------------------------------------
// Current UTC ISO string (for updated_at, completed_at, etc.)
// ---------------------------------------------------------------------------
export function nowUTC(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Parse a date string safely into a Date for CST display.
// Handles both DATE (YYYY-MM-DD) and TIMESTAMPTZ (ISO) values.
// ---------------------------------------------------------------------------
export function parseForDisplay(dateStr: string | Date): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) {
    // PG DATE columns come back as midnight-UTC Date objects — treat them
    // as calendar dates so they don't shift to the previous day in CST.
    if (
      dateStr.getUTCHours() === 0 &&
      dateStr.getUTCMinutes() === 0 &&
      dateStr.getUTCSeconds() === 0 &&
      dateStr.getUTCMilliseconds() === 0
    ) {
      const y = dateStr.getUTCFullYear();
      const m = String(dateStr.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dateStr.getUTCDate()).padStart(2, "0");
      return new Date(`${y}-${m}-${d}T12:00:00`);
    }
    return toZonedTime(dateStr, TIMEZONE);
  }
  // ISO string at exact midnight UTC — same PG DATE case after serialization
  const midnightUtc = dateStr.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/);
  if (midnightUtc) {
    return new Date(midnightUtc[1] + "T12:00:00");
  }
  // TIMESTAMPTZ — already has timezone info, convert to CST
  if (dateStr.includes("T") || dateStr.includes("Z") || dateStr.includes("+")) {
    return toZonedTime(new Date(dateStr), TIMEZONE);
  }
  // DATE only (YYYY-MM-DD) — treat as a calendar date, not a UTC instant
  return new Date(dateStr + "T12:00:00");
}

// ---------------------------------------------------------------------------
// Format: MM/DD/YYYY  (standard display for all dates)
// ---------------------------------------------------------------------------
export function formatDate(dateStr: string | Date): string {
  if (!dateStr) return "";
  return fnsFormat(parseForDisplay(dateStr), "MM/dd/yyyy");
}

// ---------------------------------------------------------------------------
// Format: MM/DD/YYYY h:mm a  (for timestamps like created_at)
// ---------------------------------------------------------------------------
export function formatDateTime(dateStr: string | Date): string {
  if (!dateStr) return "";
  return fnsFormat(parseForDisplay(dateStr), "MM/dd/yyyy h:mm a");
}

// ---------------------------------------------------------------------------
// Format: Mon, Feb 14  (compact, for calendar / gantt headers)
// ---------------------------------------------------------------------------
export function formatDateCompact(dateStr: string | Date): string {
  if (!dateStr) return "";
  return fnsFormat(parseForDisplay(dateStr), "EEE, MMM d");
}

// ---------------------------------------------------------------------------
// Format: Feb 14  (short, for badges / stat labels)
// ---------------------------------------------------------------------------
export function formatDateShort(dateStr: string | Date): string {
  if (!dateStr) return "";
  return fnsFormat(parseForDisplay(dateStr), "MMM d");
}

// ---------------------------------------------------------------------------
// Format: Feb 14, 2026  (medium length)
// ---------------------------------------------------------------------------
export function formatDateMedium(dateStr: string | Date): string {
  if (!dateStr) return "";
  return fnsFormat(parseForDisplay(dateStr), "MMM d, yyyy");
}

// ---------------------------------------------------------------------------
// Format: Sat, Feb 14, 2026  (long, for popovers / titles)
// ---------------------------------------------------------------------------
export function formatDateLong(dateStr: string | Date): string {
  if (!dateStr) return "";
  return fnsFormat(parseForDisplay(dateStr), "EEE, MMM d, yyyy");
}

// ---------------------------------------------------------------------------
// Format: February 2026  (for month headers)
// ---------------------------------------------------------------------------
export function formatMonthYear(date: Date): string {
  return fnsFormat(date, "MMMM yyyy");
}

// ---------------------------------------------------------------------------
// Relative time: "just now", "5m ago", "3h ago", "7d ago", or MM/DD/YYYY
// ---------------------------------------------------------------------------
export function formatRelativeTime(dateStr: string | Date): string {
  const now = nowCST();
  const date = parseForDisplay(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

// ---------------------------------------------------------------------------
// Check if a date is before today in CST
// ---------------------------------------------------------------------------
export function isBeforeToday(dateStr: string | Date): boolean {
  if (!dateStr) return false;
  const today = todayCST();
  const s = dateStr instanceof Date ? dateStr.toISOString() : dateStr;
  const dateOnly = s.includes("T") ? s.split("T")[0] : s;
  return dateOnly < today;
}

// ---------------------------------------------------------------------------
// Check if a date is today or in the future in CST
// ---------------------------------------------------------------------------
export function isTodayOrFuture(dateStr: string | Date): boolean {
  if (!dateStr) return false;
  const today = todayCST();
  const s = dateStr instanceof Date ? dateStr.toISOString() : dateStr;
  const dateOnly = s.includes("T") ? s.split("T")[0] : s;
  return dateOnly >= today;
}

// ---------------------------------------------------------------------------
// Days overdue (positive = overdue, negative = days remaining)
// ---------------------------------------------------------------------------
export function daysFromToday(dateStr: string | Date): number {
  const today = todayCST();
  const s = dateStr instanceof Date ? dateStr.toISOString() : dateStr;
  const dateOnly = s.includes("T") ? s.split("T")[0] : s;
  const diff = new Date(today).getTime() - new Date(dateOnly).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Format time string (HH:MM:SS or HH:MM) to 12-hour format
// ---------------------------------------------------------------------------
export function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Add days to a YYYY-MM-DD string, return YYYY-MM-DD
// ---------------------------------------------------------------------------
export function getTimeframeDate(code: string): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const fmt = (d: Date) => fnsFormat(d, "yyyy-MM-dd");
  const addDays = (d: Date, days: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  };
  const isWeekday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

  switch (code) {
    case "1d": return fmt(addDays(today, 1));
    case "3d": return fmt(addDays(today, 3));
    case "1w": return fmt(addDays(today, 7));
    case "1m": return fmt(addDays(today, 30));
    case "eow-w": {
      let d = 5 - today.getDay();
      if (d < 0) d += 7;
      return fmt(addDays(today, d));
    }
    case "eom-w": {
      const last = new Date(year, month + 1, 0);
      while (!isWeekday(last)) last.setDate(last.getDate() - 1);
      return fmt(last);
    }
    case "eom-c": return fmt(new Date(year, month + 1, 0));
    case "bow-w": {
      let d = (8 - today.getDay()) % 7;
      if (d === 0) d = 7;
      return fmt(addDays(today, d));
    }
    case "bom-w": {
      const first = new Date(year, month + 1, 1);
      while (!isWeekday(first)) first.setDate(first.getDate() + 1);
      return fmt(first);
    }
    case "bom-c": return fmt(new Date(year, month + 1, 1));
    default: return fmt(today);
  }
}

export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return fnsFormat(d, "yyyy-MM-dd");
}

// ---------------------------------------------------------------------------
// End of day in CST for a YYYY-MM-DD string, returned as a UTC ISO string.
// Use when persisting a calendar date into a TIMESTAMPTZ column so it round-trips
// to the same CST calendar day instead of slipping back to the prior day.
// ---------------------------------------------------------------------------
export function endOfDayCST(dateStr: string): string {
  return fromZonedTime(`${dateStr}T23:59:59.999`, TIMEZONE).toISOString();
}

// ---------------------------------------------------------------------------
// Get end of range (today + N days) as YYYY-MM-DD in CST
// ---------------------------------------------------------------------------
export function futureDateCST(days: number): string {
  const now = nowCST();
  now.setDate(now.getDate() + days);
  return fnsFormat(now, "yyyy-MM-dd");
}
