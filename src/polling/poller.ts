import type { VehicleLink } from '../link/vehicleLink';
import { CALC_INPUTS } from '../profiles/calculated';
import type { Parameter, Profile } from '../profiles/schema';
import type { Reading, ReadingProblem } from '../state/live';

/** How long to wait before retrying a parameter the vehicle said it doesn't have. */
const UNSUPPORTED_RETRY_MS = 30_000;
/** Battery voltage changes slowly; reading it flat out only floods the adapter. */
const VOLTAGE_INTERVAL_MS = 500;
/**
 * A missed answer ("no data") isn't proof a parameter doesn't exist: the bus drops out while
 * cranking. So after a few misses in a row, wait a little before asking again, doubling
 * the wait each time up to UNSUPPORTED_RETRY_MS. One answer resets it.
 */
const MISSES_BEFORE_BACKOFF = 3;
const FIRST_BACKOFF_MS = 2000;
/** Full passes with no answer at all before the vehicle is treated as gone quiet (key off). */
const SILENT_PASSES = 2;
/** How often background parameters (trip inputs) are read when nothing on screen needs them. */
const BACKGROUND_MS = 1000;
/** A zero is only taken from readings this recent, so a stale "0 rpm" can't set it. */
const ZERO_FRESH_MS = 3000;

export interface PollerSink {
  readonly setReadings: (readings: Readonly<Record<string, Reading>>) => void;
  readonly setProblem: (id: string, problem: ReadingProblem | null) => void;
  /** Called when a vehicle that was answering stops answering everything. */
  readonly onSilent?: () => void;
  /** Called when a silent vehicle answers again (key turned on, engine started). */
  readonly onAwake?: () => void;
  /** Called with a sensor's new engine-off reading, so it can be remembered for next time. */
  readonly onZero?: (sensorId: string, value: number) => void;
}

/**
 * Reads the active parameters over and over, one request at a time.
 *
 * Parameters on screen come first; derived ones (boost = MAP − BARO) pull in what they
 * need and are computed after each pass.
 */
export class Poller {
  /** Bumped on every start/stop so an old loop notices it should end. */
  private generation = 0;
  private running = false;
  private active: readonly string[] = [];
  private background: readonly string[] = [];
  private readonly skipUntil = new Map<string, number>();
  private readonly latest = new Map<string, number>();
  private readonly readAt = new Map<string, number>();
  private readonly misses = new Map<string, number>();
  private readonly zeros: Map<string, number>;
  private readonly pendingZeros = new Map<string, number>();
  private silentPasses = 0;
  private readonly byId: ReadonlyMap<string, Parameter>;
  /** Shortest time between the starts of two passes (the user's update-rate setting). */
  private passMs = 0;
  /** True while the vehicle isn't answering anything, so "no data" means "no reply". */
  private silent = false;

  constructor(
    private readonly link: VehicleLink,
    profile: Profile,
    private readonly sink: PollerSink,
    private supported: ReadonlySet<number> | null,
    /** Engine-off sensor readings remembered from earlier sessions, by sensor id. */
    zeros: Readonly<Record<string, number>> = {},
  ) {
    this.byId = new Map(profile.parameters.map((p) => [p.id, p]));
    this.zeros = new Map(Object.entries(zeros));
  }

  /** Marks the vehicle as not answering, or (once it answers) starts over with what it supports. */
  setVehicleSilent(silent: boolean, supported: ReadonlySet<number> | null = this.supported): void {
    this.silent = silent;
    this.supported = supported;
    this.silentPasses = 0;
    if (!silent) {
      this.skipUntil.clear(); // retry everything straight away
      this.misses.clear();
    }
  }

  /** Limits how often the screen updates: 0 for as fast as the vehicle answers. */
  setPassInterval(ms: number): void {
    this.passMs = ms;
  }

  /** Sets which parameters to read, most important first. */
  setActive(ids: readonly string[]): void {
    this.active = ids;
  }

  /**
   * Parameters to keep reading about once a second whatever is on screen (speed and fuel
   * flow, so trip distance and fuel used keep counting).
   */
  setBackground(ids: readonly string[]): void {
    this.background = ids;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop(++this.generation);
  }

  stop(): void {
    this.running = false;
    this.generation++;
  }

  private async loop(generation: number): Promise<void> {
    const current = () => generation === this.generation;
    while (current()) {
      const plan = this.plan();
      if (plan.reads.length === 0) {
        await sleep(250);
        continue;
      }
      const started = Date.now();
      let asked = 0;
      let answered = 0;
      for (const param of plan.reads) {
        if (!current()) return;
        const outcome = await this.readOne(param);
        if (outcome !== 'adapter') asked++;
        if (outcome === 'answered') answered++;
      }
      this.computeDerived(plan.derived);
      this.notePass(asked, answered);
      // Always hand control back between passes, even when every answer came back instantly.
      await sleep(Math.max(0, this.passMs - (Date.now() - started)));
    }
  }

  private plan(): { reads: Parameter[]; derived: Parameter[] } {
    const reads = new Map<string, Parameter>();
    const derived: Parameter[] = [];
    const now = Date.now();
    const want = (id: string): void => {
      const param = this.byId.get(id);
      if (!param || reads.has(id)) return;
      const request = param.request;
      if (!request) {
        this.sink.setProblem(id, 'noRequest');
        return;
      }
      if (request.type === 'difference') {
        if (!derived.includes(param)) derived.push(param);
        want(request.minuend);
        want(request.subtrahend);
        return;
      }
      if (request.type === 'calc') {
        // Worked out elsewhere (src/trip/calculator.ts) from these readings.
        for (const input of CALC_INPUTS[request.calc]) want(input);
        return;
      }
      if (request.type === 'zeroed') {
        if (!derived.includes(param)) derived.push(param);
        want(request.of);
        want(request.idle); // to know when the engine is stopped, so the zero can be taken
        if (request.fallback && !this.zeros.has(request.of)) want(request.fallback);
        return;
      }
      if (
        request.type === 'obd' &&
        this.supported &&
        !this.supported.has(parseInt(request.pid, 16))
      ) {
        this.sink.setProblem(id, 'unsupported');
        return;
      }
      if ((this.skipUntil.get(id) ?? 0) > now) return;
      const every =
        param.pollMs ?? (request.type === 'adapterVoltage' ? VOLTAGE_INTERVAL_MS : undefined);
      if (every !== undefined && now - (this.readAt.get(id) ?? 0) < every) return;
      reads.set(id, param);
    };
    for (const id of this.active) want(id);
    for (const id of this.background) {
      if (!reads.has(id) && now - (this.readAt.get(id) ?? 0) >= BACKGROUND_MS) want(id);
    }
    // Standard requests together, then mode 22 together: switching module address costs a
    // round trip, so this keeps it to two switches per pass. Order within a group is kept.
    const group = (p: Parameter) => (p.request?.type === 'manufacturer' ? 1 : 0);
    return { reads: [...reads.values()].sort((a, b) => group(a) - group(b)), derived };
  }

  /** A vehicle that stops answering everything has most likely been switched off. */
  private notePass(asked: number, answered: number): void {
    if (this.silent || asked === 0) return;
    this.silentPasses = answered === 0 ? this.silentPasses + 1 : 0;
    if (this.silentPasses >= SILENT_PASSES) {
      this.silent = true;
      for (const id of this.byId.keys()) this.sink.setProblem(id, null);
      this.sink.onSilent?.();
    }
  }

  /** Reads one parameter. Says whether the vehicle answered, didn't, or it was the adapter's own. */
  private async readOne(param: Parameter): Promise<'answered' | 'missed' | 'adapter'> {
    this.readAt.set(param.id, Date.now());
    const fromAdapter = param.request?.type === 'adapterVoltage';
    const result = await this.link.read(param);
    if (result.ok) {
      if (this.silent && !fromAdapter) {
        this.setVehicleSilent(false);
        this.sink.onAwake?.();
      }
      this.misses.delete(param.id);
      this.latest.set(param.id, result.value);
      this.sink.setReadings({ [param.id]: { value: result.value, at: Date.now() } });
      this.sink.setProblem(param.id, null);
      return fromAdapter ? 'adapter' : 'answered';
    }
    if (result.error === 'rejected' || result.error === 'unknownCommand') {
      // The vehicle (or adapter) said outright it doesn't do this one.
      this.skipUntil.set(param.id, Date.now() + UNSUPPORTED_RETRY_MS);
      this.sink.setProblem(param.id, 'unsupported');
      return 'answered';
    }
    if (result.error === 'noData') {
      // One missed answer on a busy bus is normal; only give up after a few in a row.
      const misses = (this.misses.get(param.id) ?? 0) + 1;
      this.misses.set(param.id, misses);
      if (this.silent) {
        // Keep asking everything at full speed so the first answer after start-up is caught.
        this.sink.setProblem(param.id, 'noReply');
      } else if (misses >= MISSES_BEFORE_BACKOFF) {
        const wait = Math.min(
          FIRST_BACKOFF_MS * 2 ** (misses - MISSES_BEFORE_BACKOFF),
          UNSUPPORTED_RETRY_MS,
        );
        this.skipUntil.set(param.id, Date.now() + wait);
        this.sink.setProblem(param.id, 'unsupported');
      }
      return fromAdapter ? 'adapter' : 'missed';
    }
    this.sink.setProblem(param.id, 'error');
    return fromAdapter ? 'adapter' : 'missed';
  }

  private computeDerived(derived: readonly Parameter[]): void {
    const out: Record<string, Reading> = {};
    const now = Date.now();
    for (const param of derived) {
      const request = param.request;
      if (request?.type === 'difference') {
        const a = this.latest.get(request.minuend);
        const b = this.latest.get(request.subtrahend);
        if (a === undefined || b === undefined) continue;
        out[param.id] = { value: a - b, at: now };
      } else if (request?.type === 'zeroed') {
        const value = this.latest.get(request.of);
        if (value === undefined) continue;
        // Engine stopped (key on, or just before a start): this is the sensor's zero.
        const idle = this.latest.get(request.idle);
        const fresh = (id: string) => now - (this.readAt.get(id) ?? 0) < ZERO_FRESH_MS;
        // Only trust a reading taken between two "engine stopped" passes: in the pass where
        // the engine fires, the sensor may already have moved after RPM was read as 0.
        if (idle === 0 && fresh(request.idle) && fresh(request.of)) {
          const pending = this.pendingZeros.get(request.of);
          if (pending !== undefined && this.zeros.get(request.of) !== pending) {
            this.zeros.set(request.of, pending);
            this.sink.onZero?.(request.of, pending);
          }
          this.pendingZeros.set(request.of, value);
        } else {
          this.pendingZeros.delete(request.of);
        }
        const zero =
          this.zeros.get(request.of) ??
          (request.fallback ? this.latest.get(request.fallback) : undefined);
        if (zero === undefined) continue;
        out[param.id] = { value: value - zero, at: now };
      }
    }
    if (Object.keys(out).length > 0) this.sink.setReadings(out);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
