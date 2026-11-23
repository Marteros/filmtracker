import { describe, expect, it } from 'vitest';
import { mapLimit } from './concurrency';

describe('mapLimit', () => {
  it('maps all items with a concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;
    const result = await mapLimit([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value * 2;
    });
    expect(result).toEqual([2, 4, 6, 8, 10]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('aborts when signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(mapLimit([1, 2, 3], 2, async (v) => v, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
