import type { Parameter } from './schema';

/** Applies a parameter's formula to the data bytes of an OBD reply. */
export function decodeValue(param: Parameter, data: readonly number[]): number | null {
  const { skip, bytes, scale, offset, signed, bit } = param.decode;
  if (data.length < skip + bytes) return null;
  if (bit !== undefined) return ((data[skip] ?? 0) >> bit) & 1;
  let raw = 0;
  for (let i = 0; i < bytes; i++) raw = raw * 256 + (data[skip + i] ?? 0);
  if (signed && raw >= 2 ** (bytes * 8 - 1)) raw -= 2 ** (bytes * 8);
  return raw * scale + offset;
}

/** The inverse of decodeValue, used by the simulator to build replies. */
export function encodeValue(param: Parameter, value: number): number[] {
  const { skip, bytes, scale, offset, bit } = param.decode;
  if (bit !== undefined) {
    const flags: number[] = Array.from({ length: skip }, (_, i) => (i === 0 ? 0xff : 0));
    return [...flags, (value >= 0.5 ? 1 : 0) << bit];
  }
  const max = 2 ** (bytes * 8) - 1;
  let raw = Math.round((value - offset) / scale);
  if (raw < 0) raw += param.decode.signed ? 2 ** (bytes * 8) : 0;
  raw = Math.min(Math.max(raw, 0), max);
  // Skipped bytes (support flags) are sent as "all present"; the rest are zero.
  const out: number[] = Array.from({ length: skip }, (_, i) => (i === 0 ? 0xff : 0));
  for (let i = bytes - 1; i >= 0; i--) out.push(Math.floor(raw / 256 ** i) % 256);
  return out;
}
