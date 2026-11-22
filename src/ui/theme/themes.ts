import type { GaugeStyle } from '../../profiles/schema';
import type { Backlight } from '../../state/settings';

/** Colour sets matched to each vehicle's real gauges, by day and by night. */
export interface GaugeTheme {
  readonly style: GaugeStyle;
  readonly background: string;
  readonly panel: string;
  readonly line: string;
  /** Scale markings and numbers. */
  readonly mark: string;
  /** Labels and secondary text. */
  readonly sub: string;
  readonly red: string;
  readonly needle: string;
  /** Pivot cap (Ford) or dial face centre (Subaru). */
  readonly cap: string;
  /** Subaru only: the thin outer bezel ring. */
  readonly ring: string;
  /** Round dials only: bezel ring thickness. */
  readonly ringWidth: number;
  readonly glow: boolean;
  /**
   * Subaru by day: the slate-blue band under the scale, the dark centre, and the shiny
   * blue ring between them. Without it the dial face is plain `cap`.
   */
  readonly face?: { readonly band: string; readonly centre: string; readonly ring: string };
}

export const THEMES = {
  // 1992-97 F-series, from the owner's photos: green at night with a warm yellow needle that
  // lights only outside the near-black hub; white on black by day.
  ford95: {
    night: {
      style: 'ford95',
      background: '#030504',
      panel: '#070908',
      line: '#151a17',
      mark: '#3dff74',
      sub: '#25b955',
      red: '#ff2b1c',
      needle: '#ffcd62',
      cap: '#040504',
      ring: '#151a17',
      ringWidth: 1.6,
      glow: true,
    },
    day: {
      style: 'ford95',
      background: '#0b0b0b',
      panel: '#111111',
      line: '#2a2a2a',
      mark: '#ecebe6',
      sub: '#b9b8b2',
      red: '#d8483e',
      needle: '#f4f2ec',
      cap: '#151617',
      ring: '#2a2a2a',
      ringWidth: 1.6,
      glow: false,
    },
  },
  superDuty: {
    // 2017-2024 Super Duty analog cluster (XL/XLT), from the owner's photo at night: bold
    // white numbers and ticks on a white scale ring, cyan-lit needles (sampled about #26b2cf,
    // hue 190°), an orange-red zone at the top of the tach, black faces.
    night: {
      style: 'superDuty',
      background: '#020304',
      panel: '#080a0c',
      line: '#1d2328',
      mark: '#ffffff',
      sub: '#b9c3cc',
      red: '#ff5a2a',
      needle: '#4fdfff',
      cap: '#030405',
      ring: '#eef2f5',
      ringWidth: 3,
      glow: true,
    },
    day: {
      style: 'superDuty',
      background: '#0b0b0c',
      panel: '#151719',
      line: '#2c3035',
      mark: '#f2f4f6',
      sub: '#a9b0b8',
      red: '#f0561f',
      needle: '#22b8d4',
      cap: '#08090a',
      ring: '#d9dde1',
      ringWidth: 3,
      glow: false,
    },
  },
  superDutySmall: {
    // The small gauges across the top of the same cluster (oil pressure, coolant, fuel, turbo):
    // same lighting as the main dials.
    night: {
      style: 'superDutySmall',
      background: '#020304',
      panel: '#080a0c',
      line: '#1d2328',
      mark: '#ffffff',
      sub: '#b9c3cc',
      red: '#ff5a2a',
      needle: '#4fdfff',
      cap: '#030405',
      ring: '#eef2f5',
      ringWidth: 3,
      glow: true,
    },
    day: {
      style: 'superDutySmall',
      background: '#0b0b0c',
      panel: '#151719',
      line: '#2c3035',
      mark: '#f2f4f6',
      sub: '#a9b0b8',
      red: '#f0561f',
      needle: '#22b8d4',
      cap: '#08090a',
      ring: '#d9dde1',
      ringWidth: 3,
      glow: false,
    },
  },
  subaru: {
    // From the 2016 Impreza at night: white markings and needle, thin silver bezel, red band.
    night: {
      style: 'subaru',
      background: '#020203',
      panel: '#0a0b0d',
      line: '#24272c',
      mark: '#f7f8fa',
      sub: '#b8bec6',
      red: '#ff2d55',
      needle: '#f4f6f8',
      cap: '#040405',
      ring: '#d9dee5',
      ringWidth: 1.6,
      glow: true,
    },
    day: {
      style: 'subaru',
      background: '#0b0b0c',
      panel: '#141517',
      line: '#2c2f34',
      mark: '#f2f2f2',
      sub: '#a9adb2',
      red: '#e8394f',
      needle: '#ffffff',
      cap: '#070708',
      ring: '#c3c8ce',
      ringWidth: 1.6,
      glow: false,
      // Sampled from a daytime photo of the tach.
      face: { band: '#3d4a5d', centre: '#15181c', ring: '#2aa8e4' },
    },
  },
  subaruConsole: {
    // From the 2016 Impreza centre console at night. Sampled from a photo of the real
    // console: knob rings and lettering are a true red (hue about 355-5°, e.g. #de1722,
    // #f92b26), not orange. Kept on the deep side because the glow and screens both push
    // bright red toward orange. The marker is near-white, like the car's needles.
    night: {
      style: 'subaruConsole',
      background: '#020202',
      panel: '#0b0505',
      line: '#2a0d0f',
      mark: '#f2232b',
      sub: '#c41a24',
      red: '#ff5a64',
      needle: '#fff1f0',
      cap: '#050303',
      ring: '#e0141f',
      ringWidth: 1.6,
      glow: true,
    },
    day: {
      style: 'subaruConsole',
      background: '#0b0b0c',
      panel: '#151516',
      line: '#2c2c2e',
      mark: '#f0f0f0',
      sub: '#a9adb2',
      red: '#e8392c',
      needle: '#ff7a3a',
      cap: '#09090a',
      ring: '#c9302a',
      ringWidth: 1.6,
      glow: false,
    },
  },
  cruze: {
    // 2016-19 Cruze: twin round dials in a chrome surround, black faces, white markings
    // and red needles. Night colours are a best match and still to be checked against the car.
    night: {
      style: 'cruze',
      background: '#020304',
      panel: '#0b0d10',
      line: '#23272d',
      mark: '#eef6ff',
      sub: '#9fb3c4',
      red: '#ff3b2f',
      needle: '#ff4a1f',
      cap: '#040506',
      ring: '#c9cfd6',
      ringWidth: 4.5,
      glow: true,
    },
    day: {
      style: 'cruze',
      background: '#0b0b0c',
      panel: '#16171a',
      line: '#2c2f34',
      mark: '#f4f4f4',
      sub: '#a9adb2',
      red: '#e8392c',
      needle: '#ff4a1f',
      cap: '#070708',
      ring: '#d7dbe0',
      ringWidth: 4.5,
      glow: false,
    },
  },
  performance: {
    // Aftermarket performance gauges: black face and bezel, markings lit through the dial in a
    // user-chosen colour (applied in useTheme), fluorescent red pointer.
    night: {
      style: 'performance',
      background: '#020202',
      panel: '#0a0a0b',
      line: '#232326',
      mark: '#f4f6f8',
      sub: '#f4f6f8b3',
      red: '#ff2a2a',
      needle: '#ff3b1a',
      cap: '#050505',
      ring: '#1b1b1d',
      ringWidth: 6,
      glow: true,
    },
    day: {
      style: 'performance',
      background: '#0b0b0c',
      panel: '#141416',
      line: '#2c2c2f',
      mark: '#f4f6f8',
      sub: '#f4f6f8b3',
      red: '#ff2a2a',
      needle: '#ff3b1a',
      cap: '#060606',
      ring: '#1f1f22',
      ringWidth: 6,
      glow: false,
    },
  },
} as const satisfies Record<GaugeTheme['style'], Record<'day' | 'night', GaugeTheme>>;

/** Lit colour of the Performance style's markings, per backlight setting. */
export const BACKLIGHT_COLORS: Record<Backlight, string> = {
  white: '#f4f6f8',
  red: '#ff3a3a',
  amber: '#ffb020',
  green: '#3dff6e',
  teal: '#2ee6d6',
  blue: '#3d8bff',
  purple: '#b65cff',
};
