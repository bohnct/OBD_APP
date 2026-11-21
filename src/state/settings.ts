import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PROFILE_ID, getProfile } from '../profiles/registry';
import type { GaugeStyle } from '../profiles/schema';

export type ThemeMode = 'auto' | 'day' | 'night';
export type TemperatureUnit = '°F' | '°C';
export type PressureUnit = 'psi' | 'kPa';
export type SpeedUnit = 'km/h' | 'mph';

/** Backlight colours for the Performance gauge style. */
export const BACKLIGHTS = ['white', 'red', 'amber', 'green', 'teal', 'blue', 'purple'] as const;
export type Backlight = (typeof BACKLIGHTS)[number];

export interface Settings {
  readonly profileId: string;
  readonly themeMode: ThemeMode;
  readonly temperatureUnit: TemperatureUnit;
  readonly pressureUnit: PressureUnit;
  readonly speedUnit: SpeedUnit;
  /** Performance style only: the colour the dials are lit in. */
  readonly backlight: Backlight;
  /** Gauge layouts the user changed, by profile id. Profiles without one use their default. */
  readonly layouts: Readonly<Record<string, readonly string[]>>;
  /** Gauge style picked per profile id, where a vehicle offers more than one. */
  readonly styles: Readonly<Record<string, GaugeStyle>>;
  /** Parameters shown on the plots page, by profile id. */
  readonly plots: Readonly<Record<string, readonly string[]>>;
  /** How much history the plots show, in seconds. */
  readonly historySeconds: HistorySeconds;
  /** Shortest time between updates in ms; 0 reads as fast as the vehicle answers. */
  readonly updateMs: UpdateMs;
  /** The user's own scale for a value (gauge, plot and bar alike), by profile then parameter. */
  readonly scales: Readonly<Record<string, Readonly<Record<string, ScaleOverride>>>>;
  /** Engine-off sensor readings (e.g. MAP at key-on), by profile id then sensor id. */
  readonly zeros: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/**
 * A user-set scale for one value. Numbers are in `unit`. A missing field means "use the
 * default"; a warning set to null means "no warning zone".
 */
export interface ScaleOverride {
  readonly unit?: string;
  readonly min?: number;
  readonly max?: number;
  readonly warnLow?: number | null;
  readonly warnHigh?: number | null;
}

export const UPDATE_CHOICES = [0, 250, 500, 1000] as const;
export type UpdateMs = (typeof UPDATE_CHOICES)[number];

export const HISTORY_CHOICES = [30, 60, 300, 900] as const;
export type HistorySeconds = (typeof HISTORY_CHOICES)[number];

interface SettingsActions {
  readonly update: (
    patch: Partial<Omit<Settings, 'layouts' | 'styles' | 'plots' | 'zeros' | 'scales'>>,
  ) => void;
  readonly setStyle: (profileId: string, style: GaugeStyle) => void;
  readonly setGaugeSlot: (profileId: string, slot: number, parameterId: string) => void;
  readonly resetLayout: (profileId: string) => void;
  /** Adds a parameter to the plots. Returns false if it was already there. */
  readonly addPlot: (profileId: string, parameterId: string) => boolean;
  readonly removePlot: (profileId: string, parameterId: string) => void;
  readonly setZero: (profileId: string, sensorId: string, value: number) => void;
  /** Replaces a value's scale settings; pass null to go back to the defaults. */
  readonly setScale: (profileId: string, parameterId: string, scale: ScaleOverride | null) => void;
}

export const useSettings = create<Settings & SettingsActions>()(
  persist(
    (set, get) => ({
      profileId: DEFAULT_PROFILE_ID,
      themeMode: 'auto',
      temperatureUnit: '°F',
      pressureUnit: 'psi',
      speedUnit: 'km/h',
      backlight: 'white',
      layouts: {},
      styles: {},
      plots: {},
      historySeconds: 60,
      updateMs: 0,
      zeros: {},
      scales: {},
      update: (patch) => {
        set(patch);
      },
      setStyle: (profileId, style) => {
        set((s) => ({ styles: { ...s.styles, [profileId]: style } }));
      },
      setGaugeSlot: (profileId, slot, parameterId) => {
        set((s) => {
          const layout = [...(s.layouts[profileId] ?? getProfile(profileId).gaugeLayout)];
          layout[slot] = parameterId;
          return { layouts: { ...s.layouts, [profileId]: layout } };
        });
      },
      resetLayout: (profileId) => {
        set((s) => {
          const { [profileId]: _removed, ...rest } = s.layouts;
          return { layouts: rest };
        });
      },
      addPlot: (profileId, parameterId) => {
        const current = get().plots[profileId] ?? [];
        if (current.includes(parameterId)) return false;
        set((s) => ({ plots: { ...s.plots, [profileId]: [...current, parameterId] } }));
        return true;
      },
      setScale: (profileId, parameterId, scale) => {
        set((s) => {
          const { [parameterId]: _old, ...rest } = s.scales[profileId] ?? {};
          return {
            scales: { ...s.scales, [profileId]: scale ? { ...rest, [parameterId]: scale } : rest },
          };
        });
      },
      setZero: (profileId, sensorId, value) => {
        set((s) => ({
          zeros: { ...s.zeros, [profileId]: { ...s.zeros[profileId], [sensorId]: value } },
        }));
      },
      removePlot: (profileId, parameterId) => {
        set((s) => ({
          plots: {
            ...s.plots,
            [profileId]: (s.plots[profileId] ?? []).filter((id) => id !== parameterId),
          },
        }));
      },
    }),
    {
      name: 'obd-gauges.settings',
      version: 7,
      // Fill in anything older versions didn't save.
      migrate: (persisted) =>
        ({
          styles: {},
          backlight: 'white',
          plots: {},
          historySeconds: 60,
          updateMs: 0,
          zeros: {},
          scales: {},
          ...(persisted as object),
        }) as Settings & SettingsActions,
    },
  ),
);

/** The gauge layout in use for a profile: the user's, or the profile's default. */
export function gaugeLayoutFor(settings: Settings, profileId: string): readonly string[] {
  return settings.layouts[profileId] ?? getProfile(profileId).gaugeLayout;
}

/** The gauge style in use for a profile: the user's pick if the vehicle offers it, else its default. */
export function gaugeStyleFor(settings: Settings, profileId: string): GaugeStyle {
  const offered = getProfile(profileId).styles;
  const picked = settings.styles[profileId];
  return picked && offered.includes(picked) ? picked : (offered[0] ?? 'subaru');
}
