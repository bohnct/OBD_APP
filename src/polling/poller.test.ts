import { describe, expect, it } from 'vitest';
import { openSimulatorLink } from '../link/vehicleLink';
import { getProfile } from '../profiles/registry';
import type { Reading } from '../state/live';
import { Poller } from './poller';

describe('Poller', () => {
  it('reads active parameters and computes boost from MAP and BARO', async () => {
    const profile = getProfile('ford-f250-73-1995');
    const link = await openSimulatorLink(profile, { onBlocked: () => undefined });
    const readings: Record<string, Reading> = {};
    const poller = new Poller(
      link,
      profile,
      { setReadings: (r) => Object.assign(readings, r), setProblem: () => undefined },
      null,
    );
    poller.setActive(['boost', 'icp']);
    poller.start();
    await new Promise((r) => setTimeout(r, 300));
    poller.stop();
    await link.close();

    expect(readings.icp?.value).toBeGreaterThan(0);
    expect(readings.mapAbs).toBeDefined();
    expect(readings.baro).toBeDefined();
    const boost = readings.boost?.value ?? NaN;
    expect(boost).toBeCloseTo((readings.mapAbs?.value ?? 0) - (readings.baro?.value ?? 0), 0);
  });
});
