/** Outcome of reading an OBD reply from an ELM327. */
export type ObdReply =
  | { readonly ok: true; readonly data: readonly number[] }
  | { readonly ok: false; readonly error: ObdReplyError; readonly raw: string };

export type ObdReplyError =
  | 'noData' // vehicle didn't answer this request
  | 'notConnected' // adapter couldn't find a vehicle bus
  | 'busError' // bus or wiring problem
  | 'rejected' // vehicle answered with a negative response
  | 'unknownCommand' // adapter didn't understand
  | 'malformed'; // couldn't find the expected answer

const ERROR_TEXT: readonly [RegExp, ObdReplyError][] = [
  [/NO DATA/, 'noData'],
  [/UNABLE TO CONNECT|BUS INIT[:.\s]*ERROR|SEARCHING\.\.\.\s*$/, 'notConnected'],
  [/BUS ERROR|CAN ERROR|BUS BUSY|FB ERROR|DATA ERROR|<RX ERROR|STOPPED|BUFFER FULL/, 'busError'],
  [/^\?$/m, 'unknownCommand'],
];

/** Splits a reply into lines of hex, dropping status chatter like "SEARCHING...". */
export function replyLines(raw: string): string[] {
  return raw
    .split(/[\r\n]+/)
    .map((line) => line.trim().replace(/\s+/g, '').toUpperCase())
    .filter((line) => line.length > 0 && !line.startsWith('SEARCHING'));
}

/**
 * Finds the answer to `request` (e.g. "010C") in a raw reply and returns its data bytes.
 *
 * A positive answer echoes the request with 0x40 added to the mode: "010C" → "410C1AF8".
 * Several modules may answer; the first matching line wins. CAN multi-frame replies
 * ("0:..", "1:..") are joined first.
 */
export function parseObdReply(raw: string, request: string): ObdReply {
  for (const [pattern, error] of ERROR_TEXT) {
    if (pattern.test(raw)) return { ok: false, error, raw };
  }

  const lines = joinMultiFrame(replyLines(raw));
  const mode = parseInt(request.slice(0, 2), 16);
  const echo = (mode + 0x40).toString(16).toUpperCase().padStart(2, '0') + request.slice(2);
  const negative = `7F${request.slice(0, 2)}`;

  for (const line of lines) {
    if (!/^[0-9A-F]+$/.test(line) || line.length % 2 !== 0) continue;
    const at = line.indexOf(echo);
    if (at !== -1 && at % 2 === 0) {
      return { ok: true, data: toBytes(line.slice(at + echo.length)) };
    }
    if (line.includes(negative)) return { ok: false, error: 'rejected', raw };
  }
  return { ok: false, error: 'malformed', raw };
}

/** Reads the ATRV reply ("12.6V") as volts. */
export function parseVoltage(raw: string): number | null {
  const match = /(\d+(?:\.\d+)?)\s*V/i.exec(raw);
  return match?.[1] ? Number(match[1]) : null;
}

/** Joins CAN multi-frame replies ("0:..", "1:..") into one line. */
export function joinMultiFrame(lines: string[]): string[] {
  const frames = lines.filter((line) => /^[0-9A-F]:/.test(line));
  if (frames.length === 0) return lines;
  return [frames.map((line) => line.slice(2)).join('')];
}

function toBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  return bytes;
}
