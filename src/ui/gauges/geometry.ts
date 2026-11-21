/** Angles are in degrees, counter-clockwise from 3 o'clock, as in maths (SVG y is flipped here). */
export function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

/** SVG path for an arc from angle a0 to a1 (either direction). */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 < a0 ? 1 : 0;
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${String(r)},${String(r)} 0 ${String(large)} ${String(sweep)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
}

/** Where `value` sits on [lo, hi], clamped to 0..1. */
export function fraction(value: number, lo: number, hi: number): number {
  if (hi === lo) return 0;
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

export const fmt = (n: number) => n.toFixed(1);
