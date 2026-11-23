const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

/** Parse a `YYYY-MM-DD` value as a local date (no timezone shift). */
export function parseDateOnly(value?: string): number | undefined {
  if (!value) return undefined;
  const match = DATE_ONLY.exec(value);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

/** Parse a `YYYY-MM-DD` value as a local `Date`. */
export function parseDate(value?: string): Date | undefined {
  const timestamp = parseDateOnly(value);
  return timestamp === undefined ? undefined : new Date(timestamp);
}

/** Format an epoch timestamp as `YYYY-MM-DD` in local time. */
export function toDateInput(value?: number): string {
  if (!value) return '';
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Stable `YYYY-MM` key for grouping by month. */
export function monthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatLongDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatShortDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Release label for watchlist cards: "Available" or "From 12 Mar". */
export function formatReleaseLabel(value?: string): string {
  const date = new Date(`${value?.slice(0, 10)}T00:00:00`);
  if (!value || Number.isNaN(date.getTime())) return '';
  if (date.getTime() <= Date.now()) return 'Available';
  return `From ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}
