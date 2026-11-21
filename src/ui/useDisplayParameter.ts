import { useMemo } from 'react';
import type { Parameter } from '../profiles/schema';
import { useFlagTimers, type FlagTimer } from '../state/flagTimers';
import { useLive } from '../state/live';
import { useSettings, type ScaleOverride } from '../state/settings';
import { decimalsFor, displayConversion, unitChoices, type Conversion } from './units';

export interface DisplayParameter {
  readonly label: string;
  readonly name: string;
  readonly unit: string;
  readonly lo: number;
  readonly hi: number;
  readonly value: number | null;
  readonly decimals: number;
  /** High warning: at or above this is the red zone. */
  readonly redline: number | undefined;
  /** Low warning: at or below this is the red zone. */
  readonly warnLow: number | undefined;
  readonly normal: readonly [number, number] | undefined;
  readonly problem: string | null;
  /** When the value was last read (ms since epoch), or null. */
  readonly updatedAt: number | null;
  /** Converts a raw value in the parameter's unit to the display unit. */
  readonly convert: (value: number) => number;
  /** True when the user has changed this value's scale. */
  readonly customised: boolean;
  /** Turns a display value into text: "ON"/"OFF" for flags, otherwise a rounded number. */
  readonly format: (value: number) => string;
  /** On/off values (e.g. DPF regeneration) are shown as a lamp, not on a scale. */
  readonly binary: boolean;
  /** For on/off values: when it turned on and how long the last on-period lasted. */
  readonly timer: FlagTimer | undefined;
}

const PROBLEM_TEXT = {
  unsupported: 'Vehicle does not report this',
  noReply: 'No reply from the vehicle',
  noRequest: 'ID not found yet',
  error: 'Read error',
} as const;

const NO_OVERRIDE: ScaleOverride = {};

/** True when a value is in either warning zone. */
export function inWarning(d: Pick<DisplayParameter, 'redline' | 'warnLow'>, v: number): boolean {
  return (d.redline !== undefined && v >= d.redline) || (d.warnLow !== undefined && v <= d.warnLow);
}

/** The scale a value is drawn on: the profile's defaults, then the user's own settings. */
export function scaleFor(
  param: Parameter,
  prefs: Parameters<typeof displayConversion>[1],
  override: ScaleOverride,
) {
  const conversion: Conversion =
    (override.unit && unitChoices(param.unit).find((c) => c.unit === override.unit)) ||
    displayConversion(param.unit, prefs);
  const { unit, convert } = conversion;
  // A converted scale (e.g. 40-130 °C shown in °F) gets round ends: 104-266 → 100-270.
  const converted = unit !== param.unit;
  const roundTo = converted && param.range[1] - param.range[0] >= 50 ? 10 : 1;
  // mpg runs the other way from L/100km and has no top end, so it gets its own scale.
  const inverse = unit === 'mpg';
  const defaultLo = inverse ? 0 : Math.floor(convert(param.range[0]) / roundTo) * roundTo;
  const defaultHi = inverse ? 60 : Math.ceil(convert(param.range[1]) / roundTo) * roundTo;
  const pick = (own: number | null | undefined, fallback: number | undefined) =>
    own === null ? undefined : (own ?? fallback);
  let lo = override.min ?? defaultLo;
  let hi = override.max ?? defaultHi;
  if (!(hi > lo)) [lo, hi] = [defaultLo, defaultHi]; // ignore an impossible scale
  return {
    unit: unit === 'state' ? '' : unit,
    convert,
    lo,
    hi,
    defaultLo,
    defaultHi,
    decimals: decimalsFor(hi - lo),
    redline: pick(
      override.warnHigh,
      param.redline === undefined || inverse ? undefined : convert(param.redline),
    ),
    warnLow: pick(
      override.warnLow,
      param.warnLow === undefined || inverse ? undefined : convert(param.warnLow),
    ),
    normal:
      param.normal && !inverse
        ? ([convert(param.normal[0]), convert(param.normal[1])] as const)
        : undefined,
  };
}

/** A parameter's live value and scale, converted to the user's display units. */
export function useDisplayParameter(param: Parameter | undefined): DisplayParameter | null {
  const reading = useLive((s) => (param ? s.readings[param.id] : undefined));
  const problem = useLive((s) => (param ? s.problems[param.id] : undefined));
  const temperatureUnit = useSettings((s) => s.temperatureUnit);
  const pressureUnit = useSettings((s) => s.pressureUnit);
  const speedUnit = useSettings((s) => s.speedUnit);
  const timer = useFlagTimers((s) => (param ? s.timers[param.id] : undefined));
  const override = useSettings((s) =>
    param ? (s.scales[s.profileId]?.[param.id] ?? NO_OVERRIDE) : NO_OVERRIDE,
  );

  const scale = useMemo(
    () => (param ? scaleFor(param, { temperatureUnit, pressureUnit, speedUnit }, override) : null),
    [param, temperatureUnit, pressureUnit, speedUnit, override],
  );

  if (!param || !scale) return null;
  return {
    label: param.short,
    name: param.name,
    unit: scale.unit,
    lo: scale.lo,
    hi: scale.hi,
    value: reading ? scale.convert(reading.value) : null,
    decimals: scale.decimals,
    redline: scale.redline,
    warnLow: scale.warnLow,
    normal: scale.normal,
    problem: problem ? PROBLEM_TEXT[problem] : null,
    updatedAt: reading?.at ?? null,
    convert: scale.convert,
    customised: override !== NO_OVERRIDE,
    format:
      param.unit === 'state'
        ? (v: number) => (v >= 0.5 ? 'ON' : 'OFF')
        : (v: number) => v.toFixed(scale.decimals),
    binary: param.unit === 'state',
    timer,
  };
}
