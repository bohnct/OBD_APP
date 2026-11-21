import { ElmClient } from '../elm/elmClient';
import { parseObdReply, parseVoltage, type ObdReplyError } from '../elm/parse';
import { decodeValue } from '../profiles/decode';
import type { Parameter, Profile } from '../profiles/schema';
import type { TrafficEntry } from '../diagnostics/trafficLog';
import type { VehicleRequest } from '../obd/requests';
import { CommandGate, GateRefusal, type RawLine } from '../safety/commandGate';
import { connectAdapter, isWebBluetoothAvailable, pickAdapter } from '../transport/webBluetooth';
import { SimulatorTransport } from '../transport/simulator';
import type { Transport } from '../transport/types';

export type ReadResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: ObdReplyError | 'blocked' | 'failed' };

/**
 * The app's only handle on a vehicle. Everything it sends goes through the CommandGate.
 */
export interface VehicleLink {
  readonly adapterName: string;
  /** Reads one parameter. Computed parameters (difference, zeroed, calc) are not read here. */
  read(param: Parameter): Promise<ReadResult>;
  /** Asks the vehicle which standard mode 01 PIDs it supports. */
  supportedPids(): Promise<ReadonlySet<number>>;
  onDisconnect(listener: () => void): () => void;
  /** Opens a fresh link to the same adapter (no picker), e.g. after it dropped out. */
  reopen(): Promise<VehicleLink>;
  close(): Promise<void>;
}

export { isWebBluetoothAvailable };

/** Hooks for watching the connection: refused commands and every exchange with the adapter. */
export interface LinkObserver {
  readonly onBlocked: (command: string) => void;
  readonly onTraffic?: (entry: TrafficEntry) => void;
}

/** Opens the browser's Bluetooth picker. Must be called from a tap. */
export async function openBluetoothLink(
  profile: Profile,
  observer: LinkObserver,
): Promise<VehicleLink> {
  const device = await pickAdapter();
  const reopen = async (): Promise<VehicleLink> =>
    openLink(await connectAdapter(device), profile, observer, reopen);
  return reopen();
}

export function openSimulatorLink(
  profile: Profile,
  observer: LinkObserver,
  options: { readonly standardOnlyOn?: string } = {},
): Promise<VehicleLink> {
  const reopen = (): Promise<VehicleLink> =>
    openLink(
      new SimulatorTransport(profile, 12, options.standardOnlyOn ?? null),
      profile,
      observer,
      reopen,
    );
  return reopen();
}

async function openLink(
  transport: Transport,
  profile: Profile,
  observer: LinkObserver,
  reopen: () => Promise<VehicleLink>,
): Promise<VehicleLink> {
  const client = new ElmClient(transport);
  const gate = new CommandGate(recording(client, observer.onTraffic), {
    allowedHeaders: profile.connection.headers,
    onBlocked: (command) => {
      observer.onBlocked(command);
      observer.onTraffic?.({ at: Date.now(), command, ms: 0, error: 'blocked by safety gate' });
    },
  });

  await gate.configure({ kind: 'reset' });
  await gate.configure({ kind: 'echoOff' });
  await gate.configure({ kind: 'linefeedsOff' });
  await gate.configure({ kind: 'spacesOff' });
  await gate.configure({ kind: 'headersOff' });
  await gate.configure({ kind: 'adaptiveTiming' });
  await gate.configure({ kind: 'protocol', protocol: profile.connection.protocol });
  // For the snapshot: which adapter firmware, and which protocol it is set to.
  await gate.configure({ kind: 'identify' }).catch(() => undefined);
  await gate.configure({ kind: 'describeProtocol' }).catch(() => undefined);

  // Some vehicles answer mode 22 only when it's addressed to the engine module itself
  // (Ford PWM: C4 10 F1), while standard requests use the broadcast header (61 6A F1).
  // Switch only when the next request needs the other one.
  const { manufacturerHeader, standardHeader } = profile.connection;
  let header: string | null = null;
  const switchHeader = async (wanted: string | undefined) => {
    if (!wanted || header === wanted) return;
    await gate.configure({ kind: 'setHeader', header: wanted });
    header = wanted;
  };
  const forStandard = () => (header === null ? Promise.resolve() : switchHeader(standardHeader));
  /** Whether the engine module answers standard requests on its own address; null = not known yet. */
  let standardOnModule: boolean | null = null;

  const guard = async (run: () => Promise<ReadResult>): Promise<ReadResult> => {
    try {
      return await run();
    } catch (error) {
      return { ok: false, error: error instanceof GateRefusal ? 'blocked' : 'failed' };
    }
  };

  // Ask the adapter to stop listening after the first answer (one module is addressed).
  // Old clones that don't know this reply "?", and then we send plain requests instead.
  let countReplies = true;
  const send = async (request: VehicleRequest): Promise<string> => {
    if (countReplies) {
      const raw = await gate.read(request, { replies: 1 });
      if (!/^\s*\?\s*$/.test(raw)) return raw;
      countReplies = false;
    }
    return gate.read(request);
  };

  const readObd = async (wire: string, request: VehicleRequest, param: Parameter) => {
    const reply = parseObdReply(await send(request), wire);
    if (!reply.ok) return { ok: false, error: reply.error } as const;
    const value = decodeValue(param, reply.data);
    return value === null
      ? ({ ok: false, error: 'malformed' } as const)
      : { ok: true as const, value };
  };

  return {
    adapterName: transport.name,

    read(param) {
      const request = param.request;
      if (
        !request ||
        request.type === 'difference' ||
        request.type === 'zeroed' ||
        request.type === 'calc'
      )
        return Promise.resolve({ ok: false, error: 'failed' });
      return guard(async () => {
        switch (request.type) {
          case 'obd': {
            const wire = `01${request.pid}`;
            const obd: VehicleRequest = { service: 'currentData', pid: parseInt(request.pid, 16) };
            // Switching address costs a round trip each way. If the engine module also
            // answers standard requests sent straight to it, stay on its address.
            const onModule = header !== null && header !== standardHeader;
            if (onModule && standardOnModule !== false) {
              const direct = await readObd(wire, obd, param);
              if (direct.ok) {
                standardOnModule = true;
                return direct;
              }
              if (standardOnModule || direct.error !== 'noData') return direct;
              await switchHeader(standardHeader);
              const broadcast = await readObd(wire, obd, param);
              if (broadcast.ok) standardOnModule = false; // it only answers the broadcast
              return broadcast;
            }
            await forStandard();
            return readObd(wire, obd, param);
          }
          case 'manufacturer': {
            const did = parseInt(request.did, 16);
            await switchHeader(manufacturerHeader);
            return readObd(`22${request.did}`, { service: 'manufacturerData', did }, param);
          }
          case 'adapterVoltage': {
            const volts = parseVoltage(await gate.configure({ kind: 'readVoltage' }));
            return volts === null ? { ok: false, error: 'malformed' } : { ok: true, value: volts };
          }
        }
      });
    },

    async supportedPids() {
      const supported = new Set<number>();
      if (standardOnModule !== true) await forStandard();
      for (let base = 0; base < 0x100; base += 0x20) {
        let raw: string;
        try {
          raw = await gate.read({ service: 'currentData', pid: base });
        } catch {
          break;
        }
        const wire = `01${base.toString(16).toUpperCase().padStart(2, '0')}`;
        const reply = parseObdReply(raw, wire);
        if (!reply.ok || reply.data.length < 4) break;
        const bits = reply.data.slice(0, 4).reduce((acc, b) => acc * 256 + b, 0);
        for (let i = 1; i <= 32; i++) {
          if (bits & (2 ** (32 - i))) supported.add(base + i);
        }
        if (!supported.has(base + 0x20)) break;
      }
      return supported;
    },

    onDisconnect: (listener) => transport.onDisconnect(listener),

    reopen,

    async close() {
      client.dispose();
      await transport.close();
    },
  };
}

/** Wraps the adapter line so every command and reply is reported, after the gate has passed it. */
function recording(line: RawLine, onTraffic: LinkObserver['onTraffic']): RawLine {
  if (!onTraffic) return line;
  return {
    async send(command) {
      const at = Date.now();
      const started = performance.now();
      try {
        const reply = await line.send(command);
        onTraffic({ at, command, reply, ms: Math.round(performance.now() - started) });
        return reply;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onTraffic({ at, command, ms: Math.round(performance.now() - started), error: message });
        throw error;
      }
    },
  };
}
