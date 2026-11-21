import type { Profile } from '../profiles/schema';
import { useLive, type Reading } from '../state/live';
import { emptyTrip, useTrip } from './trip';

/** Petrol: stoichiometric air-fuel ratio and density (g/L), for fuel flow from airflow. */
const PETROL_AFR = 14.7;
const PETROL_G_PER_L = 745;
/** Below this the car is treated as stopped (economy per distance means nothing). */
const MOVING_KMH = 3;
/** A gap longer than this between speed readings (adapter dropped, app paused) isn't counted. */
const MAX_STEP_MS = 5000;
/** Readings older than this aren't used for fuel flow. */
const FRESH_MS = 5000;

/**
 * Works out the calculated values (fuel flow and economy, trip totals, distance to empty)
 * from live readings, and keeps the trip meter counting. Returns a stop function.
 */
export function startCalculations(profile: Profile): () => void {
  const ids = new Map(
    profile.parameters.flatMap((p) =>
      p.request?.type === 'calc' ? [[p.request.calc, p.id] as const] : [],
    ),
  );
  let lastSpeed: Reading | null = null;

  const fuelFlow = (readings: Readonly<Record<string, Reading>>, now: number): number | null => {
    const fresh = (r: Reading | undefined) => (r && now - r.at < FRESH_MS ? r.value : null);
    const rate = fresh(readings.fuelRate);
    if (rate !== null) return rate;
    const maf = fresh(readings.maf);
    if (maf !== null && profile.fuel === 'gasoline') {
      return (maf * 3600) / (PETROL_AFR * PETROL_G_PER_L);
    }
    return null; // diesel without a fuel-rate PID: no way to know
  };

  return useLive.subscribe((state, previous) => {
    const speed = state.readings.speed;
    // Work only when a new speed or fuel reading arrives (also avoids reacting to our own output).
    const changed =
      speed !== previous.readings.speed ||
      state.readings.maf !== previous.readings.maf ||
      state.readings.fuelRate !== previous.readings.fuelRate ||
      state.readings.fuelLevel !== previous.readings.fuelLevel;
    if (!changed) return;
    const now = Date.now();
    const flow = fuelFlow(state.readings, now);

    // Trip meter: add the distance (and fuel) since the last speed reading.
    if (speed && speed !== lastSpeed) {
      if (lastSpeed) {
        const ms = speed.at - lastSpeed.at;
        if (ms > 0 && ms <= MAX_STEP_MS) {
          const hours = ms / 3_600_000;
          const km = ((speed.value + lastSpeed.value) / 2) * hours;
          useTrip.getState().add(profile.id, {
            distanceKm: km,
            hours,
            fuelL: flow === null ? 0 : flow * hours,
            fuelDistanceKm: flow === null ? 0 : km,
          });
        }
      }
      lastSpeed = speed;
    }

    const trip = useTrip.getState().trips[profile.id] ?? emptyTrip();
    const tripEconomy = trip.fuelDistanceKm > 0.5 ? (trip.fuelL / trip.fuelDistanceKm) * 100 : null;
    const level = state.readings.fuelLevel?.value;
    const values: Partial<Record<string, number | null>> = {
      fuelFlow: flow,
      economy:
        flow !== null && speed && speed.value >= MOVING_KMH ? (flow / speed.value) * 100 : null,
      tripDistance: trip.distanceKm,
      tripTime: trip.hours * 60,
      tripSpeed: trip.hours > 0 ? trip.distanceKm / trip.hours : null,
      tripFuel: trip.fuelDistanceKm > 0 ? trip.fuelL : null,
      tripEconomy,
      distanceToEmpty:
        level !== undefined && profile.tankLitres && tripEconomy
          ? (((level / 100) * profile.tankLitres) / tripEconomy) * 100
          : null,
    };
    const out: Record<string, Reading> = {};
    for (const [calc, value] of Object.entries(values)) {
      const id = ids.get(calc as never);
      if (id && value !== null && value !== undefined && Number.isFinite(value)) {
        out[id] = { value, at: now };
      }
    }
    if (Object.keys(out).length > 0) useLive.getState().setReadings(out);
  });
}
