import { describe, expect, it } from 'vitest';
import { openSimulatorLink } from '../link/vehicleLink';
import { getProfile } from '../profiles/registry';
import { trafficLog } from './trafficLog';

describe('traffic log', () => {
  it('records each command and reply that passed the gate', async () => {
    trafficLog.clear();
    const profile = getProfile('ford-f250-73-1995');
    const link = await openSimulatorLink(profile, {
      onBlocked: () => undefined,
      onTraffic: (e) => {
        trafficLog.add(e);
      },
    });
    const icp = profile.parameters.find((p) => p.id === 'icp');
    if (!icp) throw new Error('profile changed');
    await link.read(icp);
    await link.close();

    const commands = trafficLog.all().map((e) => e.command);
    expect(commands.slice(0, 2)).toEqual(['ATZ', 'ATE0']);
    const icpEntry = trafficLog.all().find((e) => e.command === '2214461');
    expect(icpEntry?.reply).toMatch(/^621446/);
  });
});
