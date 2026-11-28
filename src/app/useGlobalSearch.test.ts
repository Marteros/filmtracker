import { describe, expect, it } from 'vitest';
import { resolveSearchDestination } from './useGlobalSearch';

describe('resolveSearchDestination', () => {
  it('returns null for an empty query', () => {
    expect(resolveSearchDestination('')).toBeNull();
    expect(resolveSearchDestination('   ')).toBeNull();
  });

  it('always sends a non-empty query to Discover', () => {
    expect(resolveSearchDestination('arrival')).toBe('discover');
    expect(resolveSearchDestination('d')).toBe('discover');
  });
});
