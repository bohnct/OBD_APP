import { describe, expect, it } from 'vitest';
import { decodeDtc, parseDtcReply, parseMonitorStatus } from './dtc';
import { describeCode } from './dtcDescriptions';

describe('decodeDtc', () => {
  it.each([
    [0x12, 0x11, 'P1211'],
    [0x04, 0x70, 'P0470'],
    [0x01, 0x71, 'P0171'],
    [0x42, 0x34, 'C0234'],
    [0x81, 0x00, 'B0100'],
    [0xc1, 0x00, 'U0100'],
    [0x22, 0x63, 'P2263'],
  ])('%i %i → %s', (a, b, code) => {
    expect(decodeDtc(a, b)).toBe(code);
  });
});

describe('parseDtcReply', () => {
  it('reads older buses: three codes a line, padded with zeros', () => {
    const raw = '43121104701280\r43000000000000';
    expect(parseDtcReply(raw, '03', false)).toEqual({
      ok: true,
      codes: ['P1211', 'P0470', 'P1280'],
      silent: false,
    });
  });

  it('reads CAN replies with a count byte, and joins multi-frame answers', () => {
    expect(parseDtcReply('4302017101 71', '03', true)).toMatchObject({
      codes: ['P0171'], // duplicate from a second module dropped
    });
    const multi = '00A\r0:430401710300\r1:04200047000000';
    expect(parseDtcReply(multi, '03', true)).toMatchObject({
      codes: ['P0171', 'P0300', 'P0420', 'P0047'],
    });
  });

  it('treats "no codes" and NO DATA as an empty list, but marks NO DATA as silent', () => {
    expect(parseDtcReply('4300', '03', true)).toEqual({ ok: true, codes: [], silent: false });
    expect(parseDtcReply('NO DATA', '07', false)).toEqual({ ok: true, codes: [], silent: true });
  });

  it('reports a refusal and other errors', () => {
    expect(parseDtcReply('7F0A12', '0A', false)).toEqual({ ok: false, error: 'rejected' });
    expect(parseDtcReply('UNABLE TO CONNECT', '03', false)).toMatchObject({ ok: false });
  });
});

describe('monitor status', () => {
  it('reads the check engine light and code count', () => {
    expect(parseMonitorStatus(0x82)).toEqual({ mil: true, count: 2 });
    expect(parseMonitorStatus(0x00)).toEqual({ mil: false, count: 0 });
  });
});

describe('describeCode', () => {
  it("uses the maker's meaning first, then the standard one, then the system", () => {
    expect(describeCode('P1211', 'ford-f250-73-1995')).toMatchObject({ source: 'maker' });
    expect(describeCode('P0470', 'ford-f250-73-1995')).toMatchObject({ source: 'generic' });
    // The 7.3's meanings don't carry over to other Fords.
    expect(describeCode('P1211', 'ford-f350-2024-67')).toMatchObject({ source: 'group' });
    expect(describeCode('P1211', 'subaru-impreza-2016')).toEqual({
      text: 'Powertrain, maker-specific code',
      source: 'group',
    });
    expect(describeCode('C1234', 'ford-f250-73-1995').text).toMatch(/Chassis/);
  });
});
