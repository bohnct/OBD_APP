import { describe, expect, it } from 'vitest';
import { compactNumber, displayConversion, niceTicks } from './units';

const prefs = { temperatureUnit: '°F', pressureUnit: 'psi', speedUnit: 'km/h' } as const;

describe('units', () => {
  it('converts to the chosen display units', () => {
    expect(displayConversion('°C', prefs).convert(100)).toBeCloseTo(212);
    expect(displayConversion('kPa', prefs).convert(100)).toBeCloseTo(14.5, 1);
    expect(displayConversion('psi', prefs).unit).toBe('psi');
    expect(displayConversion('km/h', { ...prefs, speedUnit: 'mph' }).convert(100)).toBeCloseTo(
      62.1,
      1,
    );
  });

  it('makes round ticks', () => {
    expect(niceTicks(0, 3000)).toEqual([0, 1000, 2000, 3000]);
    expect(niceTicks(-25, 25)).toEqual([-20, -10, 0, 10, 20]);
    expect(niceTicks(10, 16)).toEqual([10, 12, 14, 16]);
  });

  it('shortens big scale labels', () => {
    expect(compactNumber(3000)).toBe('3k');
    expect(compactNumber(260)).toBe('260');
  });
});
