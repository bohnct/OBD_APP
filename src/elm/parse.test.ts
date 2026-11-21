import { describe, expect, it } from 'vitest';
import { parseObdReply, parseVoltage } from './parse';

describe('parseObdReply', () => {
  it('reads a single-module answer', () => {
    expect(parseObdReply('410C1AF8\r\r', '010C')).toEqual({ ok: true, data: [0x1a, 0xf8] });
  });

  it('tolerates spaces, echo and SEARCHING...', () => {
    expect(parseObdReply('SEARCHING...\r41 0D 32\r', '010D')).toEqual({ ok: true, data: [0x32] });
  });

  it('reads a mode 22 answer', () => {
    expect(parseObdReply('6214460420', '221446')).toEqual({ ok: true, data: [0x04, 0x20] });
  });

  it('takes the first module that answers', () => {
    expect(parseObdReply('41057B\r41057C', '0105')).toEqual({ ok: true, data: [0x7b] });
  });

  it('joins CAN multi-frame replies', () => {
    const raw = '014\r0:490201314734\r1:4A414E36374748\r2:30313531313200';
    const reply = parseObdReply(raw, '0902');
    expect(reply.ok).toBe(true);
  });

  it.each([
    ['NO DATA', 'noData'],
    ['UNABLE TO CONNECT', 'notConnected'],
    ['BUS INIT: ...ERROR', 'notConnected'],
    ['CAN ERROR', 'busError'],
    ['?', 'unknownCommand'],
    ['7F2231', 'rejected'],
    ['41FF00', 'malformed'],
  ])('%s → %s', (raw, error) => {
    expect(parseObdReply(raw, raw === '7F2231' ? '221446' : '010C')).toMatchObject({
      ok: false,
      error,
    });
  });
});

describe('parseVoltage', () => {
  it('reads ATRV', () => {
    expect(parseVoltage('12.6V')).toBe(12.6);
    expect(parseVoltage('14V')).toBe(14);
    expect(parseVoltage('?')).toBeNull();
  });
});
