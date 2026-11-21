import { create } from 'zustand';
import type { Profile } from '../profiles/schema';
import { useLive } from './live';

export interface FlagTimer {
  /** When the flag last turned on (ms since epoch), or null while it is off. */
  readonly since: number | null;
  /** How long the last completed on-period lasted (ms), or null if none this session. */
  readonly lastMs: number | null;
}

interface FlagTimerState {
  readonly timers: Readonly<Record<string, FlagTimer>>;
  readonly set: (id: string, timer: FlagTimer) => void;
  readonly clear: () => void;
}

export const useFlagTimers = create<FlagTimerState>()((set) => ({
  timers: {},
  set: (id, timer) => {
    set((s) => ({ timers: { ...s.timers, [id]: timer } }));
  },
  clear: () => {
    set({ timers: {} });
  },
}));

/** A flag reading counts as on at or above this. */
const ON = 0.5;
/** On-periods shorter than this are treated as a glitch and don't replace the last one. */
const MIN_PERIOD_MS = 3000;

/**
 * Times how long each on/off value (such as a DPF regeneration) has been on, from the
 * timestamps of the readings themselves. Returns a stop function.
 */
export function startFlagTimers(profile: Profile): () => void {
  const flags = profile.parameters.filter((p) => p.unit === 'state').map((p) => p.id);
  useFlagTimers.getState().clear();

  return useLive.subscribe((state, previous) => {
    for (const id of flags) {
      const reading = state.readings[id];
      if (!reading || reading === previous.readings[id]) continue;
      const timer = useFlagTimers.getState().timers[id] ?? { since: null, lastMs: null };
      const on = reading.value >= ON;
      if (on && timer.since === null) {
        useFlagTimers.getState().set(id, { since: reading.at, lastMs: timer.lastMs });
      } else if (!on && timer.since !== null) {
        const ms = reading.at - timer.since;
        useFlagTimers
          .getState()
          .set(id, { since: null, lastMs: ms >= MIN_PERIOD_MS ? ms : timer.lastMs });
      }
    }
  });
}

/** Elapsed time as m:ss, or h:mm:ss from an hour up. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${String(h)}:${String(m).padStart(2, '0')}:${s}` : `${String(m)}:${s}`;
}
