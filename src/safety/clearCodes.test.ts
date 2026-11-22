import { describe, expect, it, vi } from 'vitest';
import {
  authoriseClear,
  ClearRefused,
  CLEAR_AUTHORISATION_MS,
  type ClearAuthorisation,
} from './clearAuthorisation';
import { CommandGate, GateRefusal, type RawLine } from './commandGate';

function makeGate() {
  const sent: string[] = [];
  const line: RawLine = {
    send: vi.fn((cmd: string) => {
      sent.push(cmd);
      return Promise.resolve('44');
    }),
  };
  return { gate: new CommandGate(line, { allowedHeaders: [] }), sent };
}

describe('clearing trouble codes', () => {
  it('only issues an authorisation with the engine off and two confirmations', () => {
    expect(() => authoriseClear({ engineRpm: 650, confirmations: 2 })).toThrow(ClearRefused);
    expect(() => authoriseClear({ engineRpm: null, confirmations: 2 })).toThrow(ClearRefused);
    expect(() => authoriseClear({ engineRpm: 0, confirmations: 1 })).toThrow(ClearRefused);
    expect(authoriseClear({ engineRpm: 0, confirmations: 2 })).toBeTruthy();
  });

  it('sends mode 04 once per authorisation', async () => {
    const { gate, sent } = makeGate();
    const authorisation = authoriseClear({ engineRpm: 0, confirmations: 2 });
    await gate.clearCodes(authorisation);
    await expect(gate.clearCodes(authorisation)).rejects.toBeInstanceOf(GateRefusal);
    expect(sent).toEqual(['04']);
  });

  it('refuses a made-up or copied authorisation, and sends nothing', async () => {
    const { gate, sent } = makeGate();
    const forged: ClearAuthorisation = { issuedAt: Date.now() };
    await expect(gate.clearCodes(forged)).rejects.toBeInstanceOf(GateRefusal);
    const real = authoriseClear({ engineRpm: 0, confirmations: 2 });
    await expect(gate.clearCodes({ ...real })).rejects.toBeInstanceOf(GateRefusal);
    expect(sent).toEqual([]);
  });

  it('refuses an authorisation that has gone stale', async () => {
    const { gate, sent } = makeGate();
    const old = authoriseClear(
      { engineRpm: 0, confirmations: 2 },
      Date.now() - CLEAR_AUTHORISATION_MS - 1000,
    );
    await expect(gate.clearCodes(old)).rejects.toBeInstanceOf(GateRefusal);
    expect(sent).toEqual([]);
  });
});
