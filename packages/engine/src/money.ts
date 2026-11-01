import { Decimal } from 'decimal.js';

export const Exact = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_UP });
export const d = (value: Decimal.Value) => new Exact(value);

export function parseMagnitude(value: string): string {
  const text = value.trim();
  if (!/^\d{1,15}(?:\.\d{1,12})?$/.test(text)) {
    throw new Error('Use a nonnegative decimal with up to 15 integer and 12 fractional digits; no currency symbols, grouping or exponent notation.');
  }
  return d(text).toFixed();
}

export function parseDay(value: string): string {
  const text = value.trim();
  const day = text.slice(0, 10);
  const midnight = new Date(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== day) {
    throw new Error('Use a real ISO date (YYYY-MM-DD) or a timestamp with an explicit timezone.');
  }
  if (text === day) return day;
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(text)) {
    throw new Error('Timestamp requires seconds and an explicit Z or ±HH:MM timezone; use YYYY-MM-DD for a calendar date.');
  }
  const timestamp = new Date(text);
  if (!Number.isFinite(timestamp.getTime()) || !/^\d{4}-/.test(timestamp.toISOString())) throw new Error('Timestamp is outside the supported calendar range.');
  return timestamp.toISOString().slice(0, 10);
}
