import { afterEach, describe, expect, it } from 'vitest';
import { getProfile } from '../profiles/registry';
import { formatDuration, startFlagTimers, useFlagTimers } from './flagTimers';
import { useLive } from './live';

describe('flag timers', () => {
  let stop: (() => void) | undefined;
  afterEach(() => {
    stop?.();
    useLive.getState().clear();
  });

  it('times how long a regeneration runs', () => {
    stop = startFlagTimers(getProfile('ford-f350-2024-67'));
    const set = useLive.getState().setReadings;
    const timer = () => useFlagTimers.getState().timers.dpfRegen;

    set({ dpfRegen: { value: 0, at: 1000 } });
    expect(timer()).toBeUndefined();
    set({ dpfRegen: { value: 1, at: 5000 } });
    expect(timer()).toEqual({ since: 5000, lastMs: null });
    set({ dpfRegen: { value: 1, at: 9000 } });
    expect(timer()?.since).toBe(5000);
    set({ dpfRegen: { value: 0, at: 65000 } });
    expect(timer()).toEqual({ since: null, lastMs: 60000 });

    // A one-reading blip doesn't replace the last real burn.
    set({ dpfRegen: { value: 1, at: 70000 } });
    set({ dpfRegen: { value: 0, at: 70500 } });
    expect(timer()).toEqual({ since: null, lastMs: 60000 });
  });

  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(754_000)).toBe('12:34');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});
