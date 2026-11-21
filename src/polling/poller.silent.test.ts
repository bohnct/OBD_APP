import { describe, expect, it } from 'vitest';
import type { VehicleLink } from '../link/vehicleLink';
import { getProfile } from '../profiles/registry';
import type { ReadingProblem } from '../state/live';
import { Poller } from './poller';

/** A vehicle that never answers; only the adapter's own voltage reading works. */
function silentLink(reads: string[]): VehicleLink {
  return {
    adapterName: 'test',
    read: (param) => {
      reads.push(param.id);
      return Promise.resolve(
        param.request?.type === 'adapterVoltage'
          ? { ok: true, value: 12.4 }
          : { ok: false, error: 'noData' },
      );
    },
    supportedPids: () => Promise.resolve(new Set<number>()),
    onDisconnect: () => () => undefined,
    reopen: () => Promise.reject(new Error('not used')),
    close: () => Promise.resolve(),
  };
}

/** A vehicle whose answers can be switched off and on, like a key cycle or a crank. */
function switchableLink(state: { on: boolean }): VehicleLink {
  return {
    ...silentLink([]),
    read: (param) =>
      new Promise((resolve) =>
        setTimeout(() => {
          resolve(
            param.request?.type === 'adapterVoltage' || state.on
              ? { ok: true, value: 1 }
              : { ok: false, error: 'noData' },
          );
        }, 2),
      ),
  };
}

describe('Poller with a vehicle that does not answer', () => {
  it('reports "no reply" rather than "unsupported", and reads voltage at most twice a second', async () => {
    const reads: string[] = [];
    const problems: Record<string, ReadingProblem | null> = {};
    const poller = new Poller(
      silentLink(reads),
      getProfile('ford-f250-73-1995'),
      { setReadings: () => undefined, setProblem: (id, p) => (problems[id] = p) },
      null,
    );
    poller.setVehicleSilent(true);
    poller.setActive(['rpm', 'battery']);
    poller.start();
    await new Promise((r) => setTimeout(r, 400));
    poller.stop();
    expect(problems.rpm).toBe('noReply');
    expect(reads.filter((id) => id === 'battery')).toHaveLength(1);
  });

  it('notices the vehicle going quiet and keeps asking, so it catches the start-up', async () => {
    const state = { on: true };
    const events: string[] = [];
    const readings: string[] = [];
    const poller = new Poller(
      switchableLink(state),
      getProfile('ford-f250-73-1995'),
      {
        setReadings: (r) => readings.push(...Object.keys(r)),
        setProblem: () => undefined,
        onSilent: () => events.push('silent'),
        onAwake: () => events.push('awake'),
      },
      null,
    );
    poller.setActive(['rpm', 'icp']);
    poller.start();
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await wait(60);
    state.on = false; // key off, or the crank
    await wait(150);
    expect(events).toEqual(['silent']);
    readings.length = 0;
    state.on = true; // engine running
    await wait(60);
    poller.stop();
    expect(events).toEqual(['silent', 'awake']);
    expect(readings).toContain('rpm');
    expect(readings).toContain('icp');
  });
});
