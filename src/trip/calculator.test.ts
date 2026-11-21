import { beforeEach, describe, expect, it } from 'vitest';
import { getProfile } from '../profiles/registry';
import { useLive } from '../state/live';
import { startCalculations } from './calculator';
import { useTrip } from './trip';

describe('calculated values', () => {
  beforeEach(() => {
    useLive.getState().clear();
    useTrip.getState().reset('subaru-impreza-2016');
  });

  it('counts trip distance from speed and works out economy from airflow', () => {
    const profile = getProfile('subaru-impreza-2016');
    const stop = startCalculations(profile);
    const t0 = Date.now() - 4000;
    const live = useLive.getState();
    // 100 km/h for 2 s, MAF 30 g/s, tank half full.
    live.setReadings({ fuelLevel: { value: 50, at: t0 } });
    live.setReadings({ maf: { value: 30, at: Date.now() } });
    live.setReadings({ speed: { value: 100, at: t0 } });
    live.setReadings({ speed: { value: 100, at: t0 + 2000 } });
    stop();

    const r = useLive.getState().readings;
    const km = (100 * 2) / 3600;
    expect(r.calcTripDistance?.value).toBeCloseTo(km, 6);
    // 30 g/s of air at 14.7:1 and 745 g/L of petrol ≈ 9.86 L/h; at 100 km/h ≈ 9.86 L/100 km.
    const flow = (30 * 3600) / (14.7 * 745);
    expect(r.calcFuelFlow?.value).toBeCloseTo(flow, 6);
    expect(r.calcEconomy?.value).toBeCloseTo(flow, 6);
    expect(r.calcTripFuel?.value).toBeCloseTo(flow * (2 / 3600), 6);
  });

  it('gives no fuel economy for a diesel without a fuel-rate PID', () => {
    const stop = startCalculations(getProfile('ford-f250-73-1995'));
    const live = useLive.getState();
    live.setReadings({ maf: { value: 30, at: Date.now() } });
    live.setReadings({ speed: { value: 80, at: Date.now() } });
    stop();
    expect(useLive.getState().readings.calcEconomy).toBeUndefined();
  });
});

describe('every profile gets the full list', () => {
  it('adds the standard OBD-II values and calculated ones without duplicates', () => {
    for (const id of ['subaru-impreza-2016', 'ford-f250-73-1995', 'generic-obd2']) {
      const params = getProfile(id).parameters;
      const ids = params.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      // The same PID can appear more than once when it carries several values (8B, 9B).
      const fields = params.flatMap((p) =>
        p.request?.type === 'obd'
          ? [`${p.request.pid}:${String(p.decode.skip)}:${String(p.decode.bit ?? '')}`]
          : [],
      );
      expect(new Set(fields).size).toBe(fields.length);
      expect(params.length).toBeGreaterThan(70);
      expect(ids).toContain('calcDistanceToEmpty');
      expect(ids).toContain('odometer');
    }
  });
});
