import { useSyncExternalStore } from 'react';
import type { Reading } from '../state/live';

/** Oldest data kept, in ms. Longer than the longest history choice. */
const KEEP_MS = 16 * 60 * 1000;
/** Most points kept per parameter (a few per second for 16 minutes). */
const MAX_POINTS = 6000;
/** Plots redraw at most this often. */
const NOTIFY_MS = 250;

interface Series {
  t: number[];
  v: number[];
}

/**
 * Time history of every reading, kept in memory for the plots page.
 * Outside React state so recording never redraws the gauges.
 */
class History {
  private readonly series = new Map<string, Series>();
  private readonly listeners = new Set<() => void>();
  /** Time of the last notification; doubles as the plots' "now". */
  private stamp = 0;
  private pending: ReturnType<typeof setTimeout> | undefined;

  record(readings: Readonly<Record<string, Reading>>): void {
    for (const [id, reading] of Object.entries(readings)) {
      let s = this.series.get(id);
      if (!s) {
        s = { t: [], v: [] };
        this.series.set(id, s);
      }
      const last = s.t.at(-1);
      if (last !== undefined && reading.at <= last) continue; // same reading again
      s.t.push(reading.at);
      s.v.push(reading.value);
      this.prune(s, reading.at);
    }
    this.scheduleNotify();
  }

  /** Points for one parameter from `since` (ms since epoch) onward. */
  since(
    id: string,
    since: number,
  ): { readonly t: readonly number[]; readonly v: readonly number[] } {
    const s = this.series.get(id);
    if (!s) return { t: [], v: [] };
    let start = s.t.length;
    while (start > 0 && (s.t[start - 1] ?? 0) >= since) start--;
    return { t: s.t.slice(start), v: s.v.slice(start) };
  }

  clear(): void {
    this.series.clear();
    this.scheduleNotify();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getStamp = (): number => this.stamp;

  private prune(s: Series, now: number): void {
    let drop = 0;
    while (drop < s.t.length && (s.t[drop] ?? 0) < now - KEEP_MS) drop++;
    drop = Math.max(drop, s.t.length - MAX_POINTS);
    if (drop > 0) {
      s.t.splice(0, drop);
      s.v.splice(0, drop);
    }
  }

  private scheduleNotify(): void {
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = undefined;
      this.stamp = Date.now();
      for (const listener of this.listeners) listener();
    }, NOTIFY_MS);
  }
}

export const history = new History();

/**
 * The time the history last changed (ms since epoch). Re-renders the caller whenever new
 * data arrives, at most 4 times a second; plots use it as "now".
 */
export function useHistoryClock(): number {
  return useSyncExternalStore(history.subscribe, history.getStamp);
}
