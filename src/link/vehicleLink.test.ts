import { describe, expect, it } from 'vitest';
import { getProfile } from '../profiles/registry';
import { openSimulatorLink } from './vehicleLink';

describe('VehicleLink against the simulator', () => {
  it('reads standard and Ford mode 22 parameters through the gate', async () => {
    const profile = getProfile('ford-f250-73-1995');
    const blocked: string[] = [];
    const traffic: string[] = [];
    const link = await openSimulatorLink(profile, {
      onBlocked: (c) => blocked.push(c),
      onTraffic: (e) => traffic.push(e.command),
    });
    const icp = profile.parameters.find((p) => p.id === 'icp');
    const battery = profile.parameters.find((p) => p.id === 'battery');
    if (!icp || !battery) throw new Error('profile changed');

    const icpResult = await link.read(icp);
    expect(icpResult.ok).toBe(true);
    if (icpResult.ok) expect(icpResult.value).toBeGreaterThan(400);

    const volts = await link.read(battery);
    expect(volts).toMatchObject({ ok: true });
    expect(blocked).toEqual([]);
    expect(traffic).toContain('2214461');
    await link.close();
  });

  it('addresses Ford mode 22 to the engine module, and stays there when it also answers standard PIDs', async () => {
    const profile = getProfile('ford-f250-73-1995');
    const traffic: string[] = [];
    const link = await openSimulatorLink(profile, {
      onBlocked: () => undefined,
      onTraffic: (e) => traffic.push(e.command),
    });
    const byId = (id: string) => {
      const p = profile.parameters.find((x) => x.id === id);
      if (!p) throw new Error(`profile has no ${id}`);
      return p;
    };
    const start = traffic.length;
    await link.read(byId('icp'));
    await link.read(byId('eot'));
    await link.read(byId('load'));
    await link.read(byId('icp'));
    expect(traffic.slice(start)).toEqual([
      'ATSHC410F1',
      '2214461',
      '2213101',
      '01041', // answered on the module's address, so no switch back
      '2214461',
    ]);
    await link.close();
  });

  it('switches to the broadcast address when the module ignores standard requests', async () => {
    const profile = getProfile('ford-f250-73-1995');
    const traffic: string[] = [];
    const link = await openSimulatorLink(
      profile,
      { onBlocked: () => undefined, onTraffic: (e) => traffic.push(e.command) },
      { standardOnlyOn: '616AF1' },
    );
    const byId = (id: string) => {
      const p = profile.parameters.find((x) => x.id === id);
      if (!p) throw new Error(`profile has no ${id}`);
      return p;
    };
    const start = traffic.length;
    await link.read(byId('icp'));
    expect((await link.read(byId('rpm'))).ok).toBe(true);
    await link.read(byId('icp'));
    expect((await link.read(byId('rpm'))).ok).toBe(true);
    expect(traffic.slice(start)).toEqual([
      'ATSHC410F1',
      '2214461',
      '010C1', // tried on the module's address: no answer
      'ATSH616AF1',
      '010C1',
      'ATSHC410F1',
      '2214461',
      'ATSH616AF1', // now known: switch straight away
      '010C1',
    ]);
    await link.close();
  });

  it('discovers supported PIDs from the vehicle', async () => {
    const profile = getProfile('subaru-impreza-2016');
    const link = await openSimulatorLink(profile, { onBlocked: () => undefined });
    const pids = await link.supportedPids();
    expect(pids.has(0x0c)).toBe(true);
    expect(pids.has(0x5e)).toBe(true);
    expect(pids.has(0x02)).toBe(false);
    await link.close();
  });
});

describe('trouble codes over the link', () => {
  it("reads stored and pending codes and the check engine light in the bus's own layout", async () => {
    const link = await openSimulatorLink(getProfile('ford-f250-73-1995'), {
      onBlocked: () => undefined,
    });
    const result = await link.readCodes();
    expect(result).toMatchObject({
      ok: true,
      codes: { mil: true, stored: ['P1211', 'P0470'], pending: ['P1280'] },
    });
    await link.close();
  });

  it('refuses to clear while the engine is running, and sends no clear request', async () => {
    const traffic: string[] = [];
    const link = await openSimulatorLink(getProfile('ford-f250-73-1995'), {
      onBlocked: () => undefined,
      onTraffic: (e) => traffic.push(e.command),
    });
    expect(await link.clearCodes(2)).toEqual({ ok: false, error: 'engineRunning' });
    expect(traffic).not.toContain('04');
    await link.close();
  });

  it('clears with the engine off and both confirmations', async () => {
    const base = getProfile('subaru-impreza-2016');
    const engineOff = {
      ...base,
      parameters: base.parameters.map((p) =>
        p.id === 'rpm' ? { ...p, simulate: { idle: 0, load: 0 } } : p,
      ),
    };
    const link = await openSimulatorLink(engineOff, { onBlocked: () => undefined });
    expect(await link.clearCodes(1)).toEqual({ ok: false, error: 'notConfirmed' });
    expect(await link.clearCodes(2)).toEqual({ ok: true });
    expect(await link.readCodes()).toMatchObject({
      ok: true,
      codes: { mil: false, stored: [], pending: [] },
    });
    await link.close();
  });
});
