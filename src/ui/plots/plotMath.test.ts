import { describe, expect, it } from 'vitest';
import { decimate, rangeTicks, stableRange } from './plotMath';

describe('stableRange', () => {
  it('snaps to round numbers around the data', () => {
    const r = stableRange(190, 198, 1, null);
    expect(r.lo).toBeLessThanOrEqual(190);
    expect(r.hi).toBeGreaterThanOrEqual(198);
    expect(r.lo % r.step).toBe(0);
    expect(rangeTicks(r)[0]).toBe(r.lo);
  });

  it('keeps the previous range while the data fits', () => {
    const first = stableRange(700, 2400, 10, null);
    expect(stableRange(720, 2380, 10, first)).toBe(first);
    expect(stableRange(700, 2450, 10, first)).toBe(first);
  });

  it('rescales when the data leaves the range or shrinks a lot', () => {
    const first = stableRange(700, 2400, 10, null);
    expect(stableRange(700, 4000, 10, first)).not.toBe(first);
    expect(stableRange(700, 760, 10, first)).not.toBe(first);
  });
});

describe('decimate', () => {
  it('keeps the low and high of each bucket and ends on the newest point', () => {
    const t = [0, 10, 20, 30, 100, 110, 120];
    const v = [5, 9, 1, 4, 3, 3, 7];
    expect(decimate(t, v, 100)).toEqual({ t: [10, 20, 100, 120], v: [9, 1, 3, 7] });
  });

  it('gives the same points for old data whatever the window start', () => {
    const t = Array.from({ length: 50 }, (_, i) => i * 10);
    const v = t.map((x) => Math.sin(x));
    const all = decimate(t, v, 40);
    const later = decimate(t.slice(8), v.slice(8), 40);
    expect(all.t.slice(-10)).toEqual(later.t.slice(-10));
  });
});
