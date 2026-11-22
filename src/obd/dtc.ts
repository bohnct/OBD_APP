import { joinMultiFrame, replyLines, type ObdReplyError } from '../elm/parse';

/** Which list a trouble code came from. */
export type CodeKind = 'stored' | 'pending' | 'permanent';

export type DtcReply =
  | {
      readonly ok: true;
      readonly codes: readonly string[];
      /** True when the reply was NO DATA: no codes, or nothing listening (key off). */
      readonly silent: boolean;
    }
  | { readonly ok: false; readonly error: ObdReplyError };

const LETTERS = ['P', 'C', 'B', 'U'] as const;

/** Turns the two bytes of a trouble code into its name, e.g. 0x12 0x11 → "P1211". */
export function decodeDtc(a: number, b: number): string {
  const letter = LETTERS[(a >> 6) & 0x03] ?? 'P';
  const digit = (a >> 4) & 0x03;
  const rest = ((a & 0x0f) << 8) | b;
  return `${letter}${String(digit)}${rest.toString(16).toUpperCase().padStart(3, '0')}`;
}

/**
 * Reads a mode 03, 07 or 0A reply (headers off) into a list of codes.
 *
 * Older buses (J1850, ISO 9141, KWP) send codes three to a line after the echoed mode,
 * padded with 0000. CAN puts a count byte first, and a long list arrives as numbered frames.
 * Every module that answers adds its own line; duplicates are dropped.
 */
export function parseDtcReply(raw: string, mode: '03' | '07' | '0A', can: boolean): DtcReply {
  if (/NO DATA/.test(raw)) return { ok: true, codes: [], silent: true }; // often means "none"
  if (/UNABLE TO CONNECT|BUS INIT[:.\s]*ERROR/.test(raw))
    return { ok: false, error: 'notConnected' };
  if (/BUS ERROR|CAN ERROR|BUS BUSY|FB ERROR|DATA ERROR|<RX ERROR|STOPPED/.test(raw)) {
    return { ok: false, error: 'busError' };
  }
  if (/^\s*\?\s*$/m.test(raw)) return { ok: false, error: 'unknownCommand' };

  const echo = (parseInt(mode, 16) + 0x40).toString(16).toUpperCase();
  const codes: string[] = [];
  let answered = false;
  for (const line of joinMultiFrame(replyLines(raw))) {
    if (!/^[0-9A-F]+$/.test(line) || line.length % 2 !== 0) continue;
    if (line.startsWith(`7F${mode}`)) return { ok: false, error: 'rejected' };
    if (!line.startsWith(echo)) continue;
    answered = true;
    let bytes = toBytes(line.slice(echo.length));
    if (can) {
      const count = bytes[0] ?? 0;
      bytes = bytes.slice(1, 1 + count * 2);
    }
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const a = bytes[i] ?? 0;
      const b = bytes[i + 1] ?? 0;
      if (a === 0 && b === 0) continue;
      const code = decodeDtc(a, b);
      if (!codes.includes(code)) codes.push(code);
    }
  }
  return answered ? { ok: true, codes, silent: false } : { ok: false, error: 'malformed' };
}

/** Mode 01 PID 01 byte A: bit 7 is the check engine light, bits 0-6 the stored code count. */
export function parseMonitorStatus(a: number): { readonly mil: boolean; readonly count: number } {
  return { mil: (a & 0x80) !== 0, count: a & 0x7f };
}

function toBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  return bytes;
}
