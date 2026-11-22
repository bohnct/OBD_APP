import { describe, expect, it } from 'vitest';
import type { VehicleLink } from '../link/vehicleLink';
import { getProfile } from '../profiles/registry';
import { Poller } from './poller';

/** A truck whose RPM and MAP readings the test sets; BARO is a fixed 14.5 psi. */
function truck(state: { rpm: number; map: number }): VehicleLink {
  return {
    adapterName: 'test',
    read: (param) =>
      new Promise((resolve) =>
        setTimeout(() => {
          const value =
            param.id === 'rpm'
              ? state.rpm
              : param.id === 'mapAbs'
                ? state.map
                : param.id === 'baro'
                  ? 14.5
                  : 0;
          resolve({ ok: true, value });
        }, 1),
      ),
    supportedPids: () => Promise.resolve(new Set<number>()),
    readCodes: () => Promise.resolve({ ok: false, error: 'failed' } as const),
    clearCodes: () => Promise.resolve({ ok: false, error: 'failed' } as const),
    onDisconnect: () => () => undefined,
    reopen: () => Promise.reject(new Error('not used')),
    close: () => Promise.resolve(),
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('boost zeroed at key-on', () => {
  it('uses MAP with the engine stopped as zero, and remembers it', async () => {
    const state = { rpm: 0, map: 13.99 };
    const readings: Record<string, number> = {};
    const zeros: Record<string, number> = {};
    const poller = new Poller(
      truck(state),
      getProfile('ford-f250-73-1995'),
      {
        setReadings: (r) => {
          for (const [id, reading] of Object.entries(r)) readings[id] = reading.value;
        },
        setProblem: () => undefined,
        onZero: (id, v) => (zeros[id] = v),
      },
      null,
    );
    poller.setActive(['boost']);
    poller.start();
    await wait(40);
    expect(readings.boost).toBeCloseTo(0, 5); // key on: exactly zero, not -0.5
    expect(zeros.mapAbs).toBeCloseTo(13.99, 5);
    state.rpm = 2400;
    state.map = 30;
    await wait(40);
    poller.stop();
    expect(readings.boost).toBeCloseTo(30 - 13.99, 5);
  });

  it('falls back to BARO until a zero has been seen', async () => {
    const readings: Record<string, number> = {};
    const poller = new Poller(
      truck({ rpm: 700, map: 14 }),
      getProfile('ford-f250-73-1995'),
      {
        setReadings: (r) => {
          for (const [id, reading] of Object.entries(r)) readings[id] = reading.value;
        },
        setProblem: () => undefined,
      },
      null,
    );
    poller.setActive(['boost']);
    poller.start();
    await wait(30);
    poller.stop();
    expect(readings.boost).toBeCloseTo(14 - 14.5, 5);
  });

  it('starts from a zero remembered from an earlier session', async () => {
    const readings: Record<string, number> = {};
    const poller = new Poller(
      truck({ rpm: 700, map: 14 }),
      getProfile('ford-f250-73-1995'),
      {
        setReadings: (r) => {
          for (const [id, reading] of Object.entries(r)) readings[id] = reading.value;
        },
        setProblem: () => undefined,
      },
      null,
      { mapAbs: 13.9 },
    );
    poller.setActive(['boost']);
    poller.start();
    await wait(30);
    poller.stop();
    expect(readings.boost).toBeCloseTo(0.1, 5);
  });
});
