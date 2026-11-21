/** A y-axis range snapped to round numbers, with the tick values inside it. */
export interface PlotRange {
  readonly lo: number;
  readonly hi: number;
  readonly step: number;
}

const NICE = [1, 2, 2.5, 5, 10];

function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough));
  return (NICE.find((m) => m * power >= rough) ?? 10) * power;
}

/**
 * Picks a y range for the data, snapped to round steps. It sticks with the previous range
 * while the data still fits it comfortably, so the plot doesn't rescale with every reading.
 *
 * @param minSpan smallest range to show, so a steady reading isn't blown up into noise.
 */
export function stableRange(
  min: number,
  max: number,
  minSpan: number,
  previous: PlotRange | null,
): PlotRange {
  const span = Math.max(max - min, minSpan);
  const mid = (min + max) / 2;
  const step = niceStep(span / 3);
  const lo = Math.floor((mid - span * 0.62) / step) * step;
  const hi = Math.ceil((mid + span * 0.62) / step) * step;
  const next = { lo, hi, step };
  if (!previous) return next;
  const fits = min >= previous.lo && max <= previous.hi;
  const notTooLoose = hi - lo > (previous.hi - previous.lo) * 0.4;
  return fits && notTooLoose ? previous : next;
}

/** Tick values of a range, bottom to top. */
export function rangeTicks(range: PlotRange): number[] {
  const ticks: number[] = [];
  for (let v = range.lo; v <= range.hi + range.step * 1e-9; v += range.step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

/**
 * Thins a series to about `buckets` buckets for drawing, keeping each bucket's low and high
 * point so peaks survive. Buckets are fixed to the clock (not to the first point), so as old
 * points scroll off the shape of the rest of the line doesn't change.
 */
export function decimate(
  t: readonly number[],
  v: readonly number[],
  bucketMs: number,
): { t: number[]; v: number[] } {
  const out = { t: [] as number[], v: [] as number[] };
  let bucket = Number.NaN;
  let lo = -1;
  let hi = -1;
  const flush = () => {
    if (lo < 0) return;
    const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
    out.t.push(t[a] ?? 0);
    out.v.push(v[a] ?? 0);
    if (b !== a) {
      out.t.push(t[b] ?? 0);
      out.v.push(v[b] ?? 0);
    }
  };
  for (let i = 0; i < t.length; i++) {
    const b = Math.floor((t[i] ?? 0) / bucketMs);
    if (b !== bucket) {
      flush();
      bucket = b;
      lo = hi = i;
    } else {
      if ((v[i] ?? 0) < (v[lo] ?? 0)) lo = i;
      if ((v[i] ?? 0) > (v[hi] ?? 0)) hi = i;
    }
  }
  flush();
  // Always end on the newest point, so the line reaches the pointer.
  const last = t.length - 1;
  if (last >= 0 && out.t.at(-1) !== t[last]) {
    out.t.push(t[last] ?? 0);
    out.v.push(v[last] ?? 0);
  }
  return out;
}
