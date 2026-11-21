import { z } from 'zod';
import { PROTOCOLS } from '../obd/requests';

const hex = (digits: number) =>
  z.string().regex(new RegExp(`^[0-9A-F]{${String(digits)}}$`), `${String(digits)} hex digits`);

/** Physical units a parameter can be reported in. Display units are chosen in settings. */
export const UNITS = [
  'rpm',
  'km/h',
  '°C',
  '°F',
  'kPa',
  'psi',
  '%',
  'V',
  'g/s',
  '°',
  'ms',
  's',
  'km',
  'L/h',
  'mg',
  'count',
  'min',
  'Nm',
  'λ',
  'L',
  'L/100km',
  /** On/off, decoded from one bit (shown as ON or OFF). */
  'state',
] as const;
export type Unit = (typeof UNITS)[number];

/** Values the app calculates itself, Torque-style (see src/trip/calculator.ts). */
export const CALCS = [
  'fuelFlow',
  'economy',
  'tripDistance',
  'tripTime',
  'tripSpeed',
  'tripFuel',
  'tripEconomy',
  'distanceToEmpty',
] as const;
export type CalcKind = (typeof CALCS)[number];

/** Where a parameter's value comes from. */
const RequestSchema = z.discriminatedUnion('type', [
  /** Standard OBD2 mode 01. */
  z.object({ type: z.literal('obd'), pid: hex(2) }),
  /** Manufacturer data, mode 22 read by identifier. */
  z.object({ type: z.literal('manufacturer'), did: hex(4) }),
  /** Battery voltage measured by the adapter at the OBD port (AT RV). */
  z.object({ type: z.literal('adapterVoltage') }),
  /** Computed from two other parameters: minuend − subtrahend (e.g. boost = MAP − BARO). */
  z.object({ type: z.literal('difference'), minuend: z.string(), subtrahend: z.string() }),
  /**
   * A pressure relative to what the same sensor read with the engine stopped (`idle`
   * parameter at 0), e.g. boost = MAP now − MAP at key-on. Cancels each sensor's own offset.
   * Until a zero has been seen, `fallback` (another parameter) is subtracted instead.
   */
  /** Worked out by the app from other values (fuel economy, trip, distance to empty). */
  z.object({ type: z.literal('calc'), calc: z.enum(CALCS) }),
  z.object({
    type: z.literal('zeroed'),
    of: z.string(),
    idle: z.string(),
    fallback: z.string().optional(),
  }),
]);

/**
 * value = (raw × scale) + offset, raw = `bytes` data bytes (big-endian) after skipping
 * `skip` bytes. Some PIDs pack a support byte first, then several values.
 */
const DecodeSchema = z.object({
  skip: z.number().int().min(0).max(8).default(0),
  bytes: z.number().int().min(1).max(4).default(1),
  scale: z.number().default(1),
  offset: z.number().default(0),
  signed: z.boolean().default(false),
  /** For on/off flags: the value is this bit (0 = lowest) of the first byte after `skip`. */
  bit: z.number().int().min(0).max(7).optional(),
});

const ParameterSchema = z.object({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  name: z.string(),
  short: z.string().max(14),
  unit: z.enum(UNITS),
  request: RequestSchema.nullable(),
  decode: DecodeSchema.default({ skip: 0, bytes: 1, scale: 1, offset: 0, signed: false }),
  /** Gauge scale ends, in `unit`. */
  range: z.tuple([z.number(), z.number()]),
  /** Values at or past this are in the red zone. */
  redline: z.number().optional(),
  /** Values at or below this are in a low warning zone (e.g. voltage, oil pressure). */
  warnLow: z.number().optional(),
  /** The "NORMAL" band on '95-style gauges. */
  normal: z.tuple([z.number(), z.number()]).optional(),
  /** False until checked against the real vehicle. */
  verified: z.boolean().default(true),
  /** Read at most this often (ms), for values that change slowly. Default: every pass. */
  pollMs: z.number().int().positive().optional(),
  note: z.string().optional(),
  /** Simulator only: typical values at idle and under load. */
  simulate: z.object({ idle: z.number(), load: z.number() }).optional(),
  /** Where the definition came from: the vehicle profile, the standard list, or calculated. */
  source: z.enum(['profile', 'standard', 'calculated']).default('profile'),
});

export const GAUGE_SLOTS = 8;

/** Gauge looks, each matched to real instruments. */
export const GAUGE_STYLES = [
  'ford95',
  'superDuty',
  'superDutySmall',
  'subaru',
  'subaruConsole',
  'cruze',
  'performance',
] as const;
export type GaugeStyle = (typeof GAUGE_STYLES)[number];

export const ProfileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    /** Gauge styles this vehicle offers; the first is the default. */
    styles: z.array(z.enum(GAUGE_STYLES)).min(1),
    connection: z.object({
      protocol: z.enum(Object.keys(PROTOCOLS) as [keyof typeof PROTOCOLS]),
      /** Module addresses the safety gate may target with AT SH. */
      headers: z.array(hex(6)).default([]),
      /** Header to set before mode 22 requests, if the vehicle needs one. */
      manufacturerHeader: hex(6).optional(),
      /** Header to set back before standard (mode 01) requests after a mode 22 one. */
      standardHeader: hex(6).optional(),
    }),
    /** For fuel economy: petrol can be worked out from airflow; diesel needs a fuel-rate PID. */
    fuel: z.enum(['gasoline', 'diesel']).default('gasoline'),
    /** Usable tank size, for distance to empty. */
    tankLitres: z.number().positive().optional(),
    parameters: z.array(ParameterSchema).min(1),
    /** Parameter ids shown on the gauge page, top row then bottom row. */
    gaugeLayout: z.array(z.string()).length(GAUGE_SLOTS),
  })
  .superRefine((profile, ctx) => {
    const ids = new Set(profile.parameters.map((p) => p.id));
    if (ids.size !== profile.parameters.length) {
      ctx.addIssue({ code: 'custom', message: 'Parameter ids must be unique.' });
    }
    for (const id of profile.gaugeLayout) {
      if (!ids.has(id))
        ctx.addIssue({ code: 'custom', message: `Gauge slot uses unknown parameter "${id}".` });
    }
    for (const p of profile.parameters) {
      const deps =
        p.request?.type === 'difference'
          ? [p.request.minuend, p.request.subtrahend]
          : p.request?.type === 'zeroed'
            ? [p.request.of, p.request.idle, ...(p.request.fallback ? [p.request.fallback] : [])]
            : null;
      if (deps) {
        for (const dep of deps) {
          if (!ids.has(dep))
            ctx.addIssue({ code: 'custom', message: `${p.id} depends on unknown "${dep}".` });
        }
      }
    }
    const { headers, manufacturerHeader, standardHeader } = profile.connection;
    for (const [name, header] of [
      ['manufacturerHeader', manufacturerHeader],
      ['standardHeader', standardHeader],
    ] as const) {
      if (header && !headers.includes(header)) {
        ctx.addIssue({ code: 'custom', message: `${name} must also be listed in headers.` });
      }
    }
    if (manufacturerHeader && !standardHeader) {
      ctx.addIssue({
        code: 'custom',
        message: 'A profile with manufacturerHeader needs standardHeader to switch back to.',
      });
    }
  });

export type Profile = z.infer<typeof ProfileSchema>;
export type Parameter = Profile['parameters'][number];
export type ParameterRequest = NonNullable<Parameter['request']>;
