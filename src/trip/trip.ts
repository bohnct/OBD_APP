import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Running totals since the trip was last reset, kept between sessions. */
export interface TripTotals {
  readonly distanceKm: number;
  /** Litres of fuel, counted only while fuel flow is known. */
  readonly fuelL: number;
  /** Distance driven while fuel flow was known, so trip economy compares like with like. */
  readonly fuelDistanceKm: number;
  readonly hours: number;
  /** When the trip was reset (ms since epoch). */
  readonly since: number;
}

interface TripState {
  readonly trips: Readonly<Record<string, TripTotals>>;
  readonly add: (profileId: string, step: Omit<TripTotals, 'since'>) => void;
  readonly reset: (profileId: string) => void;
}

export const emptyTrip = (): TripTotals => ({
  distanceKm: 0,
  fuelL: 0,
  fuelDistanceKm: 0,
  hours: 0,
  since: Date.now(),
});

export const useTrip = create<TripState>()(
  persist(
    (set) => ({
      trips: {},
      add: (profileId, step) => {
        set((s) => {
          const t = s.trips[profileId] ?? emptyTrip();
          return {
            trips: {
              ...s.trips,
              [profileId]: {
                distanceKm: t.distanceKm + step.distanceKm,
                fuelL: t.fuelL + step.fuelL,
                fuelDistanceKm: t.fuelDistanceKm + step.fuelDistanceKm,
                hours: t.hours + step.hours,
                since: t.since,
              },
            },
          };
        });
      },
      reset: (profileId) => {
        set((s) => ({ trips: { ...s.trips, [profileId]: emptyTrip() } }));
      },
    }),
    { name: 'obd-gauges.trip', version: 1 },
  ),
);
