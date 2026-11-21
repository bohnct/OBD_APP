import type { Unit } from '../profiles/schema';
import type { Settings } from '../state/settings';

type DisplayPrefs = Pick<Settings, 'temperatureUnit' | 'pressureUnit' | 'speedUnit'>;

export interface Conversion {
  readonly unit: string;
  readonly convert: (value: number) => number;
}

const same = (unit: string): Conversion => ({ unit, convert: (v) => v });

/** Picks the display unit for a parameter and how to convert to it. */
export function displayConversion(unit: Unit, prefs: DisplayPrefs): Conversion {
  switch (unit) {
    case '°C':
      return prefs.temperatureUnit === '°F'
        ? { unit: '°F', convert: (v) => v * 1.8 + 32 }
        : same('°C');
    case '°F':
      return prefs.temperatureUnit === '°C'
        ? { unit: '°C', convert: (v) => (v - 32) / 1.8 }
        : same('°F');
    case 'kPa':
      return prefs.pressureUnit === 'psi'
        ? { unit: 'psi', convert: (v) => v * 0.145038 }
        : same('kPa');
    case 'psi':
      return prefs.pressureUnit === 'kPa'
        ? { unit: 'kPa', convert: (v) => v / 0.145038 }
        : same('psi');
    case 'km/h':
      return prefs.speedUnit === 'mph'
        ? { unit: 'mph', convert: (v) => v / 1.609344 }
        : same('km/h');
    // Distance, volume and economy follow the speed setting: mph means miles, gallons, mpg.
    case 'km':
      return prefs.speedUnit === 'mph' ? { unit: 'mi', convert: (v) => v / 1.609344 } : same('km');
    case 'L':
      return prefs.speedUnit === 'mph' ? { unit: 'gal', convert: (v) => v / 3.785412 } : same('L');
    case 'L/h':
      return prefs.speedUnit === 'mph'
        ? { unit: 'gal/h', convert: (v) => v / 3.785412 }
        : same('L/h');
    case 'L/100km':
      // US mpg is the inverse: 235.215 / (L/100km). Zero flow shows as 0 rather than infinity.
      return prefs.speedUnit === 'mph'
        ? { unit: 'mpg', convert: (v) => (v > 0 ? 235.215 / v : 0) }
        : same('L/100km');
    default:
      return same(unit);
  }
}

/** Round, evenly spaced tick values covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const rough = span / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * power >= rough) ?? 10) * power;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

/** Decimal places that suit a scale of this size. */
export function decimalsFor(span: number): number {
  if (span <= 2) return 2;
  if (span <= 20) return 1;
  return 0;
}

/** Short label for a scale end: 3000 → "3k". */
export function compactNumber(value: number): string {
  if (Math.abs(value) >= 1000 && value % 100 === 0) return `${String(value / 1000)}k`;
  return String(Number(value.toFixed(2)));
}

/** Every display unit a value in `unit` can be shown in, with how to convert to each. */
export function unitChoices(unit: Unit): readonly Conversion[] {
  const found = new Map<string, Conversion>();
  for (const temperatureUnit of ['°C', '°F'] as const)
    for (const pressureUnit of ['kPa', 'psi'] as const)
      for (const speedUnit of ['km/h', 'mph'] as const) {
        const c = displayConversion(unit, { temperatureUnit, pressureUnit, speedUnit });
        if (!found.has(c.unit)) found.set(c.unit, c);
      }
  return [...found.values()];
}
