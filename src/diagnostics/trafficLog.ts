/** One command sent to the adapter and what came back. */
export interface TrafficEntry {
  /** Wall-clock time the command was sent (ms since epoch). */
  readonly at: number;
  readonly command: string;
  readonly reply?: string;
  /** How long the adapter took to answer. */
  readonly ms: number;
  /** Set when the command timed out, failed, or was refused by the safety gate. */
  readonly error?: string;
}

const CAPACITY = 3000;

/**
 * The most recent adapter traffic, kept in memory for snapshots.
 * Deliberately outside the app state so logging never causes the screen to redraw.
 */
class TrafficLog {
  private entries: TrafficEntry[] = [];

  add(entry: TrafficEntry): void {
    this.entries.push(entry);
    if (this.entries.length > CAPACITY) this.entries.splice(0, this.entries.length - CAPACITY);
  }

  all(): readonly TrafficEntry[] {
    return this.entries;
  }

  get size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }
}

export const trafficLog = new TrafficLog();
