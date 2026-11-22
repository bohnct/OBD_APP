/**
 * The complete list of byte strings the app is allowed to send to an adapter.
 *
 * This is the second line of defence: requests are built from typed objects
 * (src/obd/requests.ts), then every encoded string is matched against these patterns
 * before it is written. Anything that does not match is refused.
 *
 * Read services only:
 *   01 current data, 02 freeze frame, 03/07/0A trouble codes, 09 vehicle info,
 *   22 read data by identifier.
 * Never: 08 control/tests, 10/11/14/27/2E/2F/31/34-37/3B/3D and any other write, reset,
 * security, routine or programming service.
 *
 * 04 (clear trouble codes) is not on this list either. It can only be sent by
 * CommandGate.clearCodes with a one-time authorisation (src/safety/clearAuthorisation.ts).
 */
export const ALLOWED_VEHICLE_PATTERNS: readonly RegExp[] = [
  /^01[0-9A-F]{2}$/, // current data
  /^02[0-9A-F]{2}[0-9A-F]{2}$/, // freeze frame: pid + frame
  /^03$/, // stored codes
  /^07$/, // pending codes
  /^0A$/, // permanent codes
  /^09[0-9A-F]{2}$/, // vehicle info
  /^22[0-9A-F]{4}$/, // read data by identifier
];

/** Clear trouble codes (mode 04): sent only by CommandGate.clearCodes, never by read(). */
export const CLEAR_CODES_WIRE = '04';

/** Fixed adapter commands. AT SH is checked separately against the vehicle profile. */
export const ALLOWED_ADAPTER_PATTERNS: readonly RegExp[] = [
  /^ATZ$/, // reset adapter
  /^ATE0$/, // echo off
  /^ATL0$/, // linefeeds off
  /^ATS0$/, // spaces off
  /^ATH0$/, // headers off
  /^ATAT1$/, // adaptive timing
  /^ATSP[0-9]$/, // select protocol (not saved: ATSP, not ATSP with save)
  /^ATDPN$/, // describe protocol number
  /^ATRV$/, // read battery voltage at the OBD port
  /^ATI$/, // identify adapter
];

export const SET_HEADER_PATTERN = /^ATSH([0-9A-F]{6})$/;

export function isAllowedVehicleCommand(wire: string): boolean {
  return ALLOWED_VEHICLE_PATTERNS.some((p) => p.test(wire));
}

export function isAllowedAdapterCommand(
  wire: string,
  allowedHeaders: ReadonlySet<string>,
): boolean {
  const header = SET_HEADER_PATTERN.exec(wire);
  if (header) return allowedHeaders.has(header[1] ?? '');
  return ALLOWED_ADAPTER_PATTERNS.some((p) => p.test(wire));
}
