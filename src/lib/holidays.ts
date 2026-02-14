// ---------------------------------------------------------------------------
// Holiday API Integration — US Federal Holidays from date.nager.at
// ---------------------------------------------------------------------------

const CACHE_KEY = "crm_federal_holidays";
const CACHE_EXPIRY_KEY = "crm_federal_holidays_expiry";
const API_BASE = "https://date.nager.at/api/v3/publicholidays";

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  types: string[];
}

export interface FederalHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  type: "federal";
}

// ---------------------------------------------------------------------------
// Fetch holidays from API for a given year
// ---------------------------------------------------------------------------
async function fetchFromAPI(year: number): Promise<FederalHoliday[]> {
  try {
    const res = await fetch(`${API_BASE}/${year}/US`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data: NagerHoliday[] = await res.json();
    // Filter to federal/public holidays only
    return data
      .filter((h) => h.types.includes("Public"))
      .map((h) => ({
        date: h.date,
        name: h.localName || h.name,
        type: "federal" as const,
      }));
  } catch (err) {
    console.error(`Failed to fetch holidays for ${year}:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Get federal holidays with localStorage caching
// Returns current year + next year holidays
// ---------------------------------------------------------------------------
export async function getFederalHolidays(): Promise<FederalHoliday[]> {
  // Check cache
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(CACHE_KEY);
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    if (cached && expiry) {
      const expiryDate = new Date(expiry);
      if (expiryDate > new Date()) {
        try {
          return JSON.parse(cached) as FederalHoliday[];
        } catch {
          // Cache corrupted, fetch fresh
        }
      }
    }
  }

  // Fetch fresh
  const currentYear = new Date().getFullYear();
  const [thisYear, nextYear] = await Promise.all([
    fetchFromAPI(currentYear),
    fetchFromAPI(currentYear + 1),
  ]);
  const holidays = [...thisYear, ...nextYear];

  // Cache with 1-year expiry
  if (typeof window !== "undefined") {
    localStorage.setItem(CACHE_KEY, JSON.stringify(holidays));
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    localStorage.setItem(CACHE_EXPIRY_KEY, expiry.toISOString());
  }

  return holidays;
}

// ---------------------------------------------------------------------------
// Build a lookup map: date string → holiday name(s)
// Useful for calendar views
// ---------------------------------------------------------------------------
export function buildHolidayMap(
  holidays: { date: string; name: string }[]
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const h of holidays) {
    if (!map[h.date]) map[h.date] = [];
    map[h.date].push(h.name);
  }
  return map;
}
