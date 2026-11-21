import { PROTOCOLS, SERVICE_MODE, type AdapterCommand, type VehicleRequest } from '../obd/requests';

const hex = (value: number, digits: number): string =>
  value.toString(16).toUpperCase().padStart(digits, '0');

function assertByte(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${what} must be a byte (0-255), got ${String(value)}`);
  }
}

/** Turns a typed vehicle request into the ELM327 hex string, e.g. currentData 0x0C → "010C". */
export function encodeVehicleRequest(req: VehicleRequest): string {
  const mode = hex(SERVICE_MODE[req.service], 2);
  switch (req.service) {
    case 'currentData':
    case 'vehicleInfo':
      assertByte(req.pid, 'PID');
      return mode + hex(req.pid, 2);
    case 'freezeFrame':
      assertByte(req.pid, 'PID');
      assertByte(req.frame, 'Frame');
      return mode + hex(req.pid, 2) + hex(req.frame, 2);
    case 'storedCodes':
    case 'pendingCodes':
    case 'permanentCodes':
      return mode;
    case 'manufacturerData':
      if (!Number.isInteger(req.did) || req.did < 0 || req.did > 0xffff) {
        throw new RangeError(`Data ID must be 0-FFFF, got ${String(req.did)}`);
      }
      return mode + hex(req.did, 4);
  }
}

/** Turns a typed adapter command into its AT string. */
export function encodeAdapterCommand(cmd: AdapterCommand): string {
  switch (cmd.kind) {
    case 'reset':
      return 'ATZ';
    case 'echoOff':
      return 'ATE0';
    case 'linefeedsOff':
      return 'ATL0';
    case 'spacesOff':
      return 'ATS0';
    case 'headersOff':
      return 'ATH0';
    case 'adaptiveTiming':
      return 'ATAT1';
    case 'protocol':
      return `ATSP${PROTOCOLS[cmd.protocol]}`;
    case 'setHeader':
      return `ATSH${cmd.header.toUpperCase()}`;
    case 'describeProtocol':
      return 'ATDPN';
    case 'readVoltage':
      return 'ATRV';
    case 'identify':
      return 'ATI';
  }
}
