/**
 * Typed descriptions of everything the app may ask an adapter or vehicle.
 *
 * The rest of the app builds these objects; only the safety gate turns them into bytes.
 * There is deliberately no type here for clearing codes, actuator tests, writes or
 * programming: those requests cannot even be expressed.
 */

/** Read requests sent to the vehicle (OBD services, SAE J1979 / Ford mode 22). */
export type VehicleRequest =
  | { readonly service: 'currentData'; readonly pid: number } // mode 01
  | { readonly service: 'freezeFrame'; readonly pid: number; readonly frame: number } // mode 02
  | { readonly service: 'storedCodes' } // mode 03
  | { readonly service: 'pendingCodes' } // mode 07
  | { readonly service: 'permanentCodes' } // mode 0A
  | { readonly service: 'vehicleInfo'; readonly pid: number } // mode 09
  | { readonly service: 'manufacturerData'; readonly did: number }; // mode 22, read by ID

/** ELM327 protocol numbers (AT SP n). */
export const PROTOCOLS = {
  auto: '0',
  j1850pwm: '1',
  j1850vpw: '2',
  iso9141: '3',
  kwpSlow: '4',
  kwpFast: '5',
  can11_500: '6',
  can29_500: '7',
  can11_250: '8',
  can29_250: '9',
} as const;

export type ProtocolName = keyof typeof PROTOCOLS;

/** Adapter configuration commands. None of these reach the vehicle. */
export type AdapterCommand =
  | { readonly kind: 'reset' }
  | { readonly kind: 'echoOff' }
  | { readonly kind: 'linefeedsOff' }
  | { readonly kind: 'spacesOff' }
  | { readonly kind: 'headersOff' }
  | { readonly kind: 'adaptiveTiming' }
  | { readonly kind: 'protocol'; readonly protocol: ProtocolName }
  | { readonly kind: 'setHeader'; readonly header: string }
  | { readonly kind: 'describeProtocol' }
  | { readonly kind: 'readVoltage' }
  | { readonly kind: 'identify' };

export const SERVICE_MODE: Record<VehicleRequest['service'], number> = {
  currentData: 0x01,
  freezeFrame: 0x02,
  storedCodes: 0x03,
  pendingCodes: 0x07,
  vehicleInfo: 0x09,
  permanentCodes: 0x0a,
  manufacturerData: 0x22,
};
