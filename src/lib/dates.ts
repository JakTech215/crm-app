import { format as fnsFormat } from "date-fns";
import { toZonedTime } from "date-fns-tz";

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
function parseForDisplay(dateStr: string): Date {
  if (!dateStr) return new Date();
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
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return fnsFormat(parseForDisplay(dateStr), "MM/dd/yyyy");
}

// ---------------------------------------------------------------------------
// Format: MM/DD/YYYY h:mm a  (for timestamps like created_at)
// ---------------------------------------------------------------------------
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return "";
  return fnsFormat(parseForDisplay(dateStr), "MM/dd/yyyy h:mm a");
}

// ---------------------------------------------------------------------------
// Format: Mon, Feb 14  (compact, for calendar / gantt headers)
// ---------------------------------------------------------------------------
export function formatDateCompact(dateStr: string): string {
  if (!dateStr) return "";
  return fnsFormat(parseForDisplay(dateStr), "EEE, MMM d");
}

// ---------------------------------------------------------------------------
// Format: Feb 14  (short, for badges / stat labels)
// ---------------------------------------------------------------------------
export function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  return fnsFormat(parseForDisplay(dateStr), "MMM d");
}

// ---------------------------------------------------------------------------
// Format: Feb 14, 2026  (medium length)
// ---------------------------------------------------------------------------
export function formatDateMedium(dateStr: string): string {
  if (!dateStr) return "";
  return fnsFormat(parseForDisplay(dateStr), "MMM d, yyyy");
}

// ---------------------------------------------------------------------------
// Format: Sat, Feb 14, 2026  (long, for popovers / titles)
// ---------------------------------------------------------------------------
export function formatDateLong(dateStr: string): string {
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
export function formatRelativeTime(dateStr: string): string {
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
export function isBeforeToday(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = todayCST();
  // Compare YYYY-MM-DD strings (works because they sort lexicographically)
  const dateOnly = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  return dateOnly < today;
}

// ---------------------------------------------------------------------------
// Check if a date is today or in the future in CST
// ---------------------------------------------------------------------------
export function isTodayOrFuture(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = todayCST();
  const dateOnly = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  return dateOnly >= today;
}

// ---------------------------------------------------------------------------
// Days overdue (positive = overdue, negative = days remaining)
// ---------------------------------------------------------------------------
export function daysFromToday(dateStr: string): number {
  const today = todayCST();
  const dateOnly = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
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
export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return fnsFormat(d, "yyyy-MM-dd");
}

// ---------------------------------------------------------------------------
// Get end of range (today + N days) as YYYY-MM-DD in CST
// ---------------------------------------------------------------------------
export function futureDateCST(days: number): string {
  const now = nowCST();
  now.setDate(now.getDate() + days);
  return fnsFormat(now, "yyyy-MM-dd");
}
