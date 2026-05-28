// Kenya official national public holidays.
//
// Fixed-date holidays come from the Public Holidays Act (Cap. 110). Easter-based
// holidays are computed each year. Islamic holidays (Idd-ul-Fitr, Idd-ul-Adha)
// and Diwali shift each year and are officially gazetted by the Cabinet
// Secretary — the dates here reflect the gazetted dates closest to the time of
// writing and should be revised when a future year is announced.

type HolidayMap = Record<string, string>;

const FIXED_HOLIDAYS: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 5, day: 1, name: 'Labour Day' },
  { month: 6, day: 1, name: 'Madaraka Day' },
  { month: 10, day: 10, name: 'Utamaduni Day' },
  { month: 10, day: 20, name: 'Mashujaa Day' },
  { month: 12, day: 12, name: 'Jamhuri Day' },
  { month: 12, day: 25, name: 'Christmas Day' },
  { month: 12, day: 26, name: 'Boxing Day' },
];

// Gazetted dates for movable Islamic and Hindu holidays. Update when new
// years are gazetted by the Cabinet Secretary.
const MOVABLE_HOLIDAYS: HolidayMap = {
  // Idd-ul-Fitr (end of Ramadan)
  '2024-04-10': 'Idd-ul-Fitr',
  '2025-03-31': 'Idd-ul-Fitr',
  '2026-03-20': 'Idd-ul-Fitr',
  '2027-03-09': 'Idd-ul-Fitr',
  '2028-02-26': 'Idd-ul-Fitr',
  // Idd-ul-Adha (Arafa)
  '2024-06-17': 'Idd-ul-Adha',
  '2025-06-07': 'Idd-ul-Adha',
  '2026-05-27': 'Idd-ul-Adha',
  '2027-05-17': 'Idd-ul-Adha',
  '2028-05-05': 'Idd-ul-Adha',
  // Diwali (gazetted public holiday in Kenya from 2024)
  '2024-11-01': 'Diwali',
  '2025-10-20': 'Diwali',
  '2026-11-08': 'Diwali',
  '2027-10-29': 'Diwali',
  '2028-10-17': 'Diwali',
};

// Meeus/Jones/Butcher Gregorian Easter algorithm — returns Easter Sunday.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const yearCache = new Map<number, HolidayMap>();

function buildYear(year: number): HolidayMap {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const map: HolidayMap = {};
  for (const { month, day, name } of FIXED_HOLIDAYS) {
    map[`${year}-${pad(month)}-${pad(day)}`] = name;
  }

  const easter = easterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  map[toKey(goodFriday)] = 'Good Friday';
  map[toKey(easterMonday)] = 'Easter Monday';

  for (const [key, name] of Object.entries(MOVABLE_HOLIDAYS)) {
    if (key.startsWith(`${year}-`)) map[key] = name;
  }

  yearCache.set(year, map);
  return map;
}

// Accepts a YYYY-MM-DD string (extra characters after the 10th are ignored).
export function getKenyaHoliday(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr.length < 10) return null;
  const key = dateStr.slice(0, 10);
  const year = Number(key.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  return buildYear(year)[key] ?? null;
}

export function isKenyaHoliday(dateStr: string | null | undefined): boolean {
  return getKenyaHoliday(dateStr) !== null;
}

// Returns holidays in [fromIso, toIso] (inclusive), sorted by date ascending.
export function getKenyaHolidaysInRange(
  fromIso: string,
  toIso: string,
): Array<{ date: string; name: string }> {
  const from = fromIso.slice(0, 10);
  const to = toIso.slice(0, 10);
  if (!from || !to || from > to) return [];
  const startYear = Number(from.slice(0, 4));
  const endYear = Number(to.slice(0, 4));
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return [];
  const out: Array<{ date: string; name: string }> = [];
  for (let y = startYear; y <= endYear; y++) {
    for (const [date, name] of Object.entries(buildYear(y))) {
      if (date >= from && date <= to) out.push({ date, name });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
