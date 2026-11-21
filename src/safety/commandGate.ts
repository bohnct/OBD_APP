import type { AdapterCommand, VehicleRequest } from '../obd/requests';
import { isAllowedAdapterCommand, isAllowedVehicleCommand } from './allowlist';
import { encodeAdapterCommand, encodeVehicleRequest } from './encode';

/** The raw line to the adapter. Only the gate holds one. */
export interface RawLine {
  /** Sends one command line and resolves with the adapter's reply (without the prompt). */
  send(command: string): Promise<string>;
}

export class GateRefusal extends Error {
  constructor(readonly command: string) {
    super(`Blocked by safety gate: "${command}" is not an allowed read request.`);
    this.name = 'GateRefusal';
  }
}

export interface GatePolicy {
  /** Module header addresses the active vehicle profile may target (AT SH values, 6 hex digits). */
  readonly allowedHeaders: readonly string[];
  /** Called for every refused command, for the log. */
  readonly onBlocked?: (command: string) => void;
}

/**
 * The only path from the app to the adapter.
 *
 * Takes typed requests, encodes them, and checks the encoded string against the
 * allowlist before sending. Refused commands are never written.
 */
export class CommandGate {
  private readonly headers: ReadonlySet<string>;

  constructor(
    private readonly line: RawLine,
    private readonly policy: GatePolicy,
  ) {
    this.headers = new Set(policy.allowedHeaders.map((h) => h.toUpperCase()));
  }

  /**
   * Sends a read request to the vehicle and returns the adapter's raw reply.
   *
   * `replies` tells the adapter how many answers to expect (ELM327: a single digit after
   * the request), so it returns as soon as they arrive instead of waiting out its timeout.
   * The digit stays in the adapter; the vehicle only ever sees the allowlisted request.
   */
  read(request: VehicleRequest, options: { readonly replies?: number } = {}): Promise<string> {
    const wire = safeEncode(() => encodeVehicleRequest(request));
    if (wire === null || !isAllowedVehicleCommand(wire)) {
      return Promise.reject(this.refuse(wire ?? describe(request)));
    }
    const { replies } = options;
    if (replies === undefined) return this.line.send(wire);
    if (!Number.isInteger(replies) || replies < 1 || replies > 9) {
      return Promise.reject(this.refuse(`${wire} (${String(replies)} replies)`));
    }
    return this.line.send(`${wire}${String(replies)}`);
  }

  /** Sends an adapter configuration command and returns the adapter's raw reply. */
  configure(command: AdapterCommand): Promise<string> {
    const wire = safeEncode(() => encodeAdapterCommand(command));
    if (wire === null || !isAllowedAdapterCommand(wire, this.headers)) {
      return Promise.reject(this.refuse(wire ?? describe(command)));
    }
    return this.line.send(wire);
  }

  private refuse(wire: string): GateRefusal {
    this.policy.onBlocked?.(wire);
    return new GateRefusal(wire);
  }
}

/** Encoding throws on malformed input (bad byte values, unknown kinds); treat that as refused. */
function safeEncode(encode: () => string): string | null {
  try {
    const wire = encode();
    return typeof wire === 'string' ? wire : null;
  } catch {
    return null;
  }
}

function describe(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
