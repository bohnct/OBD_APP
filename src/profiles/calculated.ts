import type { CalcKind } from './schema';

/**
 * Values the app works out itself from what the vehicle reports, like Torque's
 * "calculated" PIDs. The arithmetic lives in src/trip/calculator.ts.
 */
interface Calc {
  readonly calc: CalcKind;
  readonly id: string;
  readonly name: string;
  readonly short: string;
  readonly unit: string;
  readonly range: readonly [number, number];
}

const TABLE: readonly Calc[] = [
  {
    calc: 'fuelFlow',
    id: 'calcFuelFlow',
    name: 'Fuel flow (calculated)',
    short: 'FUEL FLOW',
    unit: 'L/h',
    range: [0, 30],
  },
  {
    calc: 'economy',
    id: 'calcEconomy',
    name: 'Fuel economy, instant',
    short: 'ECONOMY',
    unit: 'L/100km',
    range: [0, 30],
  },
  {
    calc: 'tripEconomy',
    id: 'calcTripEconomy',
    name: 'Fuel economy, trip average',
    short: 'TRIP ECON',
    unit: 'L/100km',
    range: [0, 30],
  },
  {
    calc: 'tripDistance',
    id: 'calcTripDistance',
    name: 'Trip distance',
    short: 'TRIP',
    unit: 'km',
    range: [0, 1000],
  },
  {
    calc: 'tripTime',
    id: 'calcTripTime',
    name: 'Trip time',
    short: 'TRIP TIME',
    unit: 'min',
    range: [0, 600],
  },
  {
    calc: 'tripSpeed',
    id: 'calcTripSpeed',
    name: 'Trip average speed',
    short: 'AVG SPEED',
    unit: 'km/h',
    range: [0, 160],
  },
  {
    calc: 'tripFuel',
    id: 'calcTripFuel',
    name: 'Fuel used this trip',
    short: 'TRIP FUEL',
    unit: 'L',
    range: [0, 100],
  },
  {
    calc: 'distanceToEmpty',
    id: 'calcDistanceToEmpty',
    name: 'Distance to empty',
    short: 'TO EMPTY',
    unit: 'km',
    range: [0, 800],
  },
];

/** The calculated values as profile parameters (before validation). */
export const CALCULATED_PARAMETERS = TABLE.map((c) => ({
  id: c.id,
  name: c.name,
  short: c.short,
  unit: c.unit,
  request: { type: 'calc', calc: c.calc },
  range: [...c.range],
  verified: true,
  source: 'calculated',
}));

/** What each calculation needs read from the vehicle, by standard parameter id. */
export const CALC_INPUTS: Readonly<Record<CalcKind, readonly string[]>> = {
  fuelFlow: ['fuelRate', 'maf'],
  economy: ['speed', 'fuelRate', 'maf'],
  tripEconomy: ['speed', 'fuelRate', 'maf'],
  tripDistance: ['speed'],
  tripTime: ['speed'],
  tripSpeed: ['speed'],
  tripFuel: ['speed', 'fuelRate', 'maf'],
  distanceToEmpty: ['speed', 'fuelRate', 'maf', 'fuelLevel'],
};
