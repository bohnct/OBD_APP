import { describe, expect, it } from 'vitest';
import { decodeValue, encodeValue } from './decode';
import { getProfile } from './registry';

const generic = getProfile('generic-obd2');
const param = (id: string) => {
  const p = generic.parameters.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};

describe('standard OBD2 formulas', () => {
  it.each([
    ['rpm', [0x1a, 0xf8], 1726],
    ['speed', [0x32], 50],
    ['coolant', [0x7b], 83],
    ['timing', [0x80], 0],
    ['maf', [0x01, 0x90], 4],
    ['fuelTrimShort', [0x80], 0],
    ['moduleVoltage', [0x36, 0xb0], 14],
  ] as const)('%s %j → %d', (id, bytes, expected) => {
    expect(decodeValue(param(id), bytes)).toBeCloseTo(expected, 3);
  });

  it('returns null when the reply is too short', () => {
    expect(decodeValue(param('rpm'), [0x1a])).toBeNull();
  });

  it('encodes back to the same value', () => {
    for (const p of generic.parameters) {
      if (p.request?.type !== 'obd') continue;
      const value = (p.range[0] + p.range[1]) / 2;
      const roundTrip = decodeValue(p, encodeValue(p, value));
      expect(roundTrip).not.toBeNull();
      expect(Math.abs((roundTrip ?? 0) - value)).toBeLessThanOrEqual(Math.abs(p.decode.scale));
    }
  });
});
