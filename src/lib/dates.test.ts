import { describe, expect, it } from 'vitest';
import { formatReleaseLabel, monthKey, parseDate, parseDateOnly, startOfDay, toDateInput } from './dates';

describe('parseDateOnly', () => {
  it('parses a date as local midnight', () => {
    const timestamp = parseDateOnly('2021-03-05');
    expect(timestamp).toBe(new Date(2021, 2, 5).getTime());
  });

  it('rejects missing or malformed values', () => {
    expect(parseDateOnly(undefined)).toBeUndefined();
    expect(parseDateOnly('')).toBeUndefined();
    expect(parseDateOnly('not-a-date')).toBeUndefined();
  });
});

describe('parseDate', () => {
  it('returns a Date instance', () => {
    const date = parseDate('2021-03-05');
    expect(date).toBeInstanceOf(Date);
    expect(date?.getDate()).toBe(5);
  });

  it('returns undefined for invalid input', () => {
    expect(parseDate('2021')).toBeUndefined();
  });
});

describe('toDateInput', () => {
  it('formats a timestamp as YYYY-MM-DD', () => {
    expect(toDateInput(new Date(2021, 2, 5).getTime())).toBe('2021-03-05');
  });

  it('returns an empty string without a value', () => {
    expect(toDateInput(undefined)).toBe('');
  });
});

describe('startOfDay', () => {
  it('drops the time portion', () => {
    const result = startOfDay(new Date(2021, 2, 5, 18, 30));
    expect(result.getHours()).toBe(0);
    expect(result.getTime()).toBe(new Date(2021, 2, 5).getTime());
  });
});

describe('monthKey', () => {
  it('builds a stable YYYY-MM key', () => {
    expect(monthKey(new Date(2021, 0, 9).getTime())).toBe('2021-01');
  });
});

describe('formatReleaseLabel', () => {
  it('returns an empty label without a date', () => {
    expect(formatReleaseLabel(undefined)).toBe('');
  });

  it('marks past releases as available', () => {
    expect(formatReleaseLabel('2000-01-01')).toBe('Available');
  });

  it('labels future releases with a date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(formatReleaseLabel(future.toISOString().slice(0, 10))).toMatch(/^From /);
  });
});
