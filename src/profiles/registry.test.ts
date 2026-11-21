import { describe, expect, it } from 'vitest';
import { getProfile, listProfiles } from './registry';

describe('vehicle profiles', () => {
  it('the Cruze adds boost from MAP and BARO', () => {
    const boost = getProfile('chevrolet-cruze-2018').parameters.find((p) => p.id === 'boost');
    expect(boost?.request).toEqual({ type: 'difference', minuend: 'map', subtrahend: 'baro' });
  });

  it('all load and validate', () => {
    expect(listProfiles().map((p) => p.id)).toEqual([
      'ford-f250-73-1995',
      'ford-f350-2024-67',
      'subaru-impreza-2016',
      'chevrolet-cruze-2018',
      'generic-obd2',
    ]);
  });

  it('the Impreza inherits the generic parameter list', () => {
    const impreza = getProfile('subaru-impreza-2016');
    expect(impreza.parameters.length).toBe(getProfile('generic-obd2').parameters.length);
    expect(impreza.connection.protocol).toBe('can11_500');
    expect(impreza.styles).toEqual(['subaru', 'subaruConsole', 'performance']);
  });

  it('the 7.3 decodes injection control pressure from its mode 22 reply', async () => {
    const { decodeValue } = await import('./decode');
    const icp = getProfile('ford-f250-73-1995').parameters.find((p) => p.id === 'icp');
    expect(icp).toBeDefined();
    if (icp) expect(decodeValue(icp, [0x03, 0xc0])).toBeCloseTo(547.2, 1); // 960 × 0.57
  });

  it('decodes multi-value diesel PIDs past their support byte', async () => {
    const { decodeValue, encodeValue } = await import('./decode');
    const f350 = getProfile('ford-f350-2024-67');
    const egt = f350.parameters.find((p) => p.id === 'egt');
    const boost = f350.parameters.find((p) => p.id === 'boostSensor');
    if (!egt || !boost) throw new Error('missing');
    // PID 78: support byte, then sensor 1 as (raw × 0.1) − 40 °C. 0x1D4C = 7500 → 710 °C.
    expect(decodeValue(egt, [0x01, 0x1d, 0x4c, 0, 0])).toBeCloseTo(710, 5);
    // PID 70: support byte, commanded A (2 bytes), then actual A × 1/32 kPa.
    expect(decodeValue(boost, [0x03, 0, 0, 0x0c, 0x80])).toBeCloseTo(100, 5);
    expect(decodeValue(boost, encodeValue(boost, 250))).toBeCloseTo(250, 1);
  });

  it('decodes the DPF regen flag and DEF values', async () => {
    const { decodeValue } = await import('./decode');
    const byId = (id: string) => {
      const p = getProfile('ford-f350-2024-67').parameters.find((x) => x.id === id);
      if (!p) throw new Error(id);
      return p;
    };
    // PID 8B: support byte, status (bit 0 = regenerating), DPF load, ...
    expect(decodeValue(byId('dpfRegen'), [0xff, 0x01, 0x80, 0, 30, 1, 0x2c])).toBe(1);
    expect(decodeValue(byId('dpfRegen'), [0xff, 0x02, 0x80, 0, 30, 1, 0x2c])).toBe(0);
    expect(decodeValue(byId('dpfSoot'), [0xff, 0x01, 0xff, 0, 30, 1, 0x2c])).toBeCloseTo(100, 5);
    expect(decodeValue(byId('dpfRegenKm'), [0xff, 0x01, 0x80, 0, 30, 1, 0x2c])).toBe(300);
    // PID 9B: support byte, DEF type, tank temperature (−40), tank level.
    expect(decodeValue(byId('defTemp'), [0xff, 0x00, 60, 0x80])).toBe(20);
    expect(decodeValue(byId('defLevel'), [0xff, 0x00, 60, 0xff])).toBeCloseTo(100, 5);
  });
});
