import { encodeValue } from '../profiles/decode';
import type { Parameter, Profile } from '../profiles/schema';
import type { Transport } from './types';

const DRIVE_CYCLE_S = 40;

/**
 * A pretend adapter and vehicle for working at the desk.
 *
 * It answers the same ELM327 commands a real adapter would, with values that rise and
 * fall on a 40-second drive cycle. Each parameter moves between its `simulate.idle` and
 * `simulate.load` values from the vehicle profile.
 */
export class SimulatorTransport implements Transport {
  readonly name = 'Simulator';
  private readonly listeners = new Set<(text: string) => void>();
  private readonly disconnectListeners = new Set<() => void>();
  private readonly startedAt = Date.now();
  private closed = false;
  private header: string | null = null;

  constructor(
    private readonly profile: Profile,
    private readonly latencyMs = 12,
    /** Header the vehicle answers standard (mode 01) requests on, if only one; for tests. */
    private readonly standardOnlyOn: string | null = null,
  ) {}

  write(text: string): Promise<void> {
    if (this.closed) return Promise.reject(new Error('Simulator closed.'));
    const reply = this.answer(text.trim().toUpperCase());
    setTimeout(() => {
      for (const listener of this.listeners) listener(`${reply}\r\r>`);
    }, this.latencyMs);
    return Promise.resolve();
  }

  onReceive(listener: (text: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  close(): Promise<void> {
    this.closed = true;
    for (const listener of this.disconnectListeners) listener();
    return Promise.resolve();
  }

  private answer(line: string): string {
    let command = line;
    if (command === 'ATZ' || command === 'ATI') return 'ELM327 v1.5 (simulator)';
    if (command === 'ATDPN') return 'A0';
    if (command === 'ATRV') {
      const battery = this.profile.parameters.find((p) => p.request?.type === 'adapterVoltage');
      return `${(battery ? this.valueOf(battery) : 12.6).toFixed(1)}V`;
    }
    if (command.startsWith('ATSH')) this.header = command.slice(4);
    if (command.startsWith('AT')) return 'OK';

    // A trailing single digit is the expected-reply count; the request is the hex before it.
    if (command.length % 2 === 1) command = command.slice(0, -1);
    const mode = command.slice(0, 2);
    if (mode === '01') {
      const wrongAddress =
        this.standardOnlyOn !== null && this.header !== null && this.header !== this.standardOnlyOn;
      return wrongAddress ? 'NO DATA' : this.currentData(command.slice(2));
    }
    if (mode === '22') return this.manufacturerData(command.slice(2));
    if (mode === '03' || mode === '07' || mode === '0A') {
      return `${(parseInt(mode, 16) + 0x40).toString(16).toUpperCase()}00`;
    }
    return 'NO DATA';
  }

  private currentData(pidHex: string): string {
    const pid = parseInt(pidHex, 16);
    if (pid % 0x20 === 0) return `41${pidHex}${this.supportedBitmap(pid)}`;
    // A PID can carry several values (e.g. 8B: regen flag, DPF load, ...): lay each into
    // the same reply at its own position, OR-ing flags that share a byte.
    const params = this.profile.parameters.filter(
      (p) => p.request?.type === 'obd' && p.request.pid === pidHex,
    );
    if (params.length === 0) return 'NO DATA';
    const data: number[] = [];
    for (const param of params) {
      encodeValue(param, this.valueOf(param)).forEach((byte, i) => {
        data[i] =
          (data[i] ?? 0) |
          (i < param.decode.skip ? 0 : byte) |
          (i === 0 && param.decode.skip > 0 ? 0xff : 0);
      });
    }
    return `41${pidHex}${toHex(Array.from(data, (b) => (b as number | undefined) ?? 0))}`;
  }

  private manufacturerData(didHex: string): string {
    const param = this.profile.parameters.find(
      (p) => p.request?.type === 'manufacturer' && p.request.did === didHex,
    );
    return param ? `62${didHex}${toHex(encodeValue(param, this.valueOf(param)))}` : 'NO DATA';
  }

  /** "PIDs supported" bitmap for the block starting at `base` (0x00, 0x20, ...). */
  private supportedBitmap(base: number): string {
    const pids = this.profile.parameters.flatMap((p) =>
      p.request?.type === 'obd' ? [parseInt(p.request.pid, 16)] : [],
    );
    let bits = 0;
    for (const pid of pids) {
      if (pid > base && pid <= base + 0x20) bits |= 1 << (32 - (pid - base));
    }
    if (pids.some((pid) => pid > base + 0x20)) bits |= 1; // next block exists
    return (bits >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  private valueOf(param: Parameter): number {
    const t = (Date.now() - this.startedAt) / 1000;
    const level = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / DRIVE_CYCLE_S);
    const [lo, hi] = param.range;
    const { idle, load } = param.simulate ?? {
      idle: lo + (hi - lo) * 0.3,
      load: lo + (hi - lo) * 0.6,
    };
    const jitter = (Math.sin(t * 7.3 + param.id.length) * Math.abs(load - idle)) / 40;
    return idle + (load - idle) * level + jitter;
  }
}

function toHex(bytes: readonly number[]): string {
  return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join('');
}
