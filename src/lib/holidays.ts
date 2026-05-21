// Meeus/Jones/Butcher algorithm for Easter Sunday
function getEasterSunday(year: number): Date {
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

const FIXED_HOLIDAYS = [
  { month: 1,  day: 1,  name: 'Año Nuevo' },
  { month: 1,  day: 6,  name: 'Reyes Magos' },
  { month: 5,  day: 1,  name: 'Día del Trabajo' },
  { month: 8,  day: 15, name: 'Asunción de la Virgen' },
  { month: 10, day: 12, name: 'Fiesta Nacional de España' },
  { month: 11, day: 1,  name: 'Todos los Santos' },
  { month: 12, day: 6,  name: 'Día de la Constitución' },
  { month: 12, day: 8,  name: 'Inmaculada Concepción' },
  { month: 12, day: 25, name: 'Navidad' },
];

// Returns the Spanish national holiday name for the date, or null if not a holiday.
export function getSpanishNationalHolidayName(date: Date): string | null {
  const month = date.getMonth() + 1;
  const day   = date.getDate();
  const year  = date.getFullYear();

  const fixed = FIXED_HOLIDAYS.find(h => h.month === month && h.day === day);
  if (fixed) return fixed.name;

  const easter = getEasterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  if (month === goodFriday.getMonth() + 1 && day === goodFriday.getDate()) return 'Viernes Santo';
  if (month === easter.getMonth() + 1     && day === easter.getDate())     return 'Domingo de Pascua';

  return null;
}

export function isSpanishNationalHoliday(date: Date): boolean {
  return getSpanishNationalHolidayName(date) !== null;
}

/**
 * Returns true if `date` is an effective holiday.
 * - National holidays count unless their ISO date appears in `disabledDates`.
 * - Custom holiday dates in `customDates` always count.
 */
export function isHoliday(
  date: Date,
  customDates: string[]    = [],
  disabledDates: string[]  = [],
): boolean {
  const iso = date.toISOString().slice(0, 10);
  if (isSpanishNationalHoliday(date) && !disabledDates.includes(iso)) return true;
  return customDates.includes(iso);
}
