import { describe, expect, it, vi } from 'vitest';
import type { AdapterCommand, VehicleRequest } from '../obd/requests';
import { isAllowedAdapterCommand, isAllowedVehicleCommand } from './allowlist';
import { CommandGate, GateRefusal, type RawLine } from './commandGate';

function makeGate(headers: string[] = ['C410F1']) {
  const sent: string[] = [];
  const blocked: string[] = [];
  const line: RawLine = {
    send: vi.fn((cmd: string) => {
      sent.push(cmd);
      return Promise.resolve('OK');
    }),
  };
  const gate = new CommandGate(line, {
    allowedHeaders: headers,
    onBlocked: (c) => blocked.push(c),
  });
  return { gate, sent, blocked };
}

describe('allowed read requests pass through', () => {
  const cases: [VehicleRequest, string][] = [
    [{ service: 'currentData', pid: 0x0c }, '010C'],
    [{ service: 'currentData', pid: 0x00 }, '0100'],
    [{ service: 'freezeFrame', pid: 0x05, frame: 0 }, '020500'],
    [{ service: 'storedCodes' }, '03'],
    [{ service: 'pendingCodes' }, '07'],
    [{ service: 'permanentCodes' }, '0A'],
    [{ service: 'vehicleInfo', pid: 0x02 }, '0902'],
    [{ service: 'manufacturerData', did: 0x1446 }, '221446'],
  ];
  it.each(cases)('%o → %s', async (request, wire) => {
    const { gate, sent } = makeGate();
    await gate.read(request);
    expect(sent).toEqual([wire]);
  });

  const adapter: [AdapterCommand, string][] = [
    [{ kind: 'reset' }, 'ATZ'],
    [{ kind: 'echoOff' }, 'ATE0'],
    [{ kind: 'protocol', protocol: 'j1850pwm' }, 'ATSP1'],
    [{ kind: 'setHeader', header: 'c410f1' }, 'ATSHC410F1'],
    [{ kind: 'readVoltage' }, 'ATRV'],
  ];
  it.each(adapter)('%o → %s', async (command, wire) => {
    const { gate, sent } = makeGate();
    await gate.configure(command);
    expect(sent).toEqual([wire]);
  });
});

describe('everything that could change the vehicle is refused', () => {
  // Services that clear, control, reset, unlock, write, run routines or program.
  const blockedServices = [
    '04', // clear trouble codes
    '08', // control on-board systems / tests
    '10',
    '1001',
    '1003', // diagnostic session control
    '11',
    '1101', // ECU reset
    '14',
    '14FFFFFF', // clear diagnostic information (UDS)
    '27',
    '2701', // security access
    '28', // communication control
    '2E',
    '2E1446FF', // write data by identifier
    '2F',
    '2F144603', // input/output control
    '31',
    '310100', // routine control
    '34',
    '35',
    '36',
    '37', // request download/upload, transfer data
    '3B',
    '3B0100', // write data by local id
    '3D', // write memory by address
    '85', // control DTC setting
    '0104FF', // valid mode with extra bytes
    '01', // incomplete
    '22144', // malformed DID
  ];
  it.each(blockedServices)('vehicle command %s is not on the allowlist', (wire) => {
    expect(isAllowedVehicleCommand(wire)).toBe(false);
  });

  const blockedAdapter = [
    'ATMA', // monitor all
    'ATPP0CSV00', // program parameters (saved to adapter)
    'ATPPFFON',
    'ATWS', // warm start
    'ATSHFFFFFF', // header not in profile
    'ATSH C410F1', // spaced header
    'ATSHC410F1\rATMA', // smuggled second command
    'ATCRA7E8', // receive filter tricks
    'STPX H:7E0, D:2E1446FF', // OBDLink raw send
    'STSBR 115200', // OBDLink baud rate change
    'STSAVE',
    'ATBRD 23', // baud rate change
    'ATSP1 ', // trailing junk
    '',
  ];
  it.each(blockedAdapter)('adapter command %j is not on the allowlist', (wire) => {
    expect(isAllowedAdapterCommand(wire, new Set(['C410F1']))).toBe(false);
  });

  it('refuses a forged request object and never writes it', async () => {
    const { gate, sent, blocked } = makeGate();
    const forged = { service: 'clearCodes' } as unknown as VehicleRequest;
    await expect(gate.read(forged)).rejects.toBeInstanceOf(GateRefusal);
    expect(sent).toEqual([]);
    expect(blocked).toHaveLength(1);
  });

  it('refuses out-of-range values instead of wrapping them', async () => {
    const { gate, sent } = makeGate();
    await expect(gate.read({ service: 'currentData', pid: 0x104 })).rejects.toBeInstanceOf(
      GateRefusal,
    );
    await expect(gate.read({ service: 'manufacturerData', did: 0x10000 })).rejects.toBeInstanceOf(
      GateRefusal,
    );
    expect(sent).toEqual([]);
  });

  it('refuses a header the vehicle profile does not list', async () => {
    const { gate, sent } = makeGate(['C410F1']);
    await expect(gate.configure({ kind: 'setHeader', header: '7E0' })).rejects.toBeInstanceOf(
      GateRefusal,
    );
    await expect(gate.configure({ kind: 'setHeader', header: '6A10F1' })).rejects.toBeInstanceOf(
      GateRefusal,
    );
    expect(sent).toEqual([]);
  });

  it('refuses a header carrying a second command', async () => {
    const { gate, sent } = makeGate(['C410F1']);
    await expect(
      gate.configure({ kind: 'setHeader', header: 'C410F1\rATMA' }),
    ).rejects.toBeInstanceOf(GateRefusal);
    expect(sent).toEqual([]);
  });
});
