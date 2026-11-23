import { describe, expect, it } from 'vitest';
import { clearOverlay, readOverlay, writeOverlay } from './overlayState';

describe('overlayState', () => {
  it('reads a missing key as undefined', () => {
    expect(readOverlay({}, 'frameSettings')).toBeUndefined();
    expect(readOverlay(null, 'frameSettings')).toBeUndefined();
  });

  it('writes and preserves other keys', () => {
    const state = writeOverlay({ frameAgenda: true }, 'frameDetails', { movieId: '1' });
    expect(state).toEqual({ frameAgenda: true, frameDetails: { movieId: '1' } });
  });

  it('clears only its own key', () => {
    const state = clearOverlay({ frameAgenda: true, frameDetails: { movieId: '1' } }, 'frameDetails');
    expect(state).toEqual({ frameAgenda: true });
  });
});
