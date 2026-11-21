import { create } from 'zustand';

export type ConnectionState =
  | { readonly status: 'disconnected' }
  | { readonly status: 'connecting' }
  | { readonly status: 'connected'; readonly adapterName: string }
  /** The adapter dropped out (often a voltage dip while cranking); trying to get it back. */
  | { readonly status: 'reconnecting'; readonly adapterName: string }
  | { readonly status: 'error'; readonly message: string };

export interface Reading {
  readonly value: number;
  readonly at: number;
}

/** Why a parameter has no current value. */
export type ReadingProblem = 'unsupported' | 'noReply' | 'noRequest' | 'error';

/**
 * Whether the vehicle's computer answers at all. The adapter can be connected and reading
 * battery voltage while the vehicle stays silent (key off, or a module that won't talk).
 */
export type VehicleState = 'unknown' | 'responding' | 'silent';

interface LiveState {
  readonly connection: ConnectionState;
  readonly readings: Readonly<Record<string, Reading>>;
  readonly problems: Readonly<Record<string, ReadingProblem>>;
  /** Commands the safety gate refused this session (should always stay empty). */
  readonly blocked: readonly string[];
  /** Standard PIDs the vehicle says it supports, once asked. */
  readonly supportedPids: readonly number[] | null;
  readonly vehicle: VehicleState;
  readonly setVehicle: (vehicle: VehicleState) => void;
  readonly setSupportedPids: (pids: readonly number[] | null) => void;
  readonly setConnection: (connection: ConnectionState) => void;
  readonly setReadings: (readings: Readonly<Record<string, Reading>>) => void;
  readonly setProblem: (id: string, problem: ReadingProblem | null) => void;
  readonly addBlocked: (command: string) => void;
  readonly clear: () => void;
}

export const useLive = create<LiveState>()((set) => ({
  connection: { status: 'disconnected' },
  readings: {},
  problems: {},
  blocked: [],
  supportedPids: null,
  vehicle: 'unknown',
  setVehicle: (vehicle) => {
    set({ vehicle });
  },
  setSupportedPids: (supportedPids) => {
    set({ supportedPids });
  },
  setConnection: (connection) => {
    set({ connection });
  },
  setReadings: (readings) => {
    set((s) => ({ readings: { ...s.readings, ...readings } }));
  },
  setProblem: (id, problem) => {
    set((s) => {
      const { [id]: _old, ...rest } = s.problems;
      return { problems: problem ? { ...rest, [id]: problem } : rest };
    });
  },
  addBlocked: (command) => {
    set((s) => ({ blocked: [...s.blocked.slice(-49), command] }));
  },
  clear: () => {
    set({ readings: {}, problems: {}, supportedPids: null, vehicle: 'unknown' });
  },
}));
