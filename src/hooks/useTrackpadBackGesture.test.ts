import { describe, expect, it } from 'vitest';
import { isBackGestureDelta } from './useTrackpadBackGesture';

describe('isBackGestureDelta', () => {
  it('recognizes a rightward horizontal trackpad gesture', () => {
    expect(isBackGestureDelta(-24, 3)).toBe(true);
  });

  it('ignores leftward and mostly vertical wheel movement', () => {
    expect(isBackGestureDelta(24, 0)).toBe(false);
    expect(isBackGestureDelta(-12, 20)).toBe(false);
  });
});
