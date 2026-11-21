import { niceTicks } from '../units';
import { arcPath, fmt, fraction, polar } from './geometry';
import { GaugeIcon } from './GaugeIcon';
import { hasIcon } from './gaugeSymbols';
import { SMALL_GEOMETRY, SMALL_LAYOUT } from './superDutyLayout';
import { GAUGE_HEIGHT, GAUGE_WIDTH, type GaugeProps } from './types';

const {
  CX,
  CY,
  R,
  DOWN,
  HALF,
  BAND,
  SEGMENTS,
  GAP,
  END_TICK,
  MID_TICK,
  WARN_OFFSET,
  NEEDLE_IN,
  NEEDLE_OUT,
} = SMALL_GEOMETRY;

/*
 * Traced from photos of the 2017+ Super Duty cluster's small gauges (oil pressure, coolant,
 * fuel, turbo boost):
 * - The scale is a thick light arc hanging below a hidden pivot, broken into segments with
 *   short ticks pointing up toward the pivot and longer ticks at both ends.
 * - A short red tick sits just past the warning end (L on oil pressure, H on coolant, E on fuel).
 * - Only a short piece of the needle shows: a solid cyan bar that straddles the arc, pointing
 *   at the pivot, so it lies flat over the ends and stands upright in the middle.
 * - The scale ends (L/H, C/H, E/F, 0/40) sit outside the arc, level with its lower part, and
 *   the gauge's symbol or name (e.g. "TURBO PSI") sits inside the arc.
 * - Like the truck, there is no number: the needle is the reading.
 */
export function SuperDutySmallGauge(props: GaugeProps) {
  const { theme, label, unit, value, decimals, redline, warnLow } = props;
  // Round the ends to whole scale steps, as the main dials do.
  const step = tickStep(props.lo, props.hi);
  const lo = Math.floor(props.lo / step) * step;
  const hi = Math.ceil(props.hi / step) * step;
  const angle = (v: number) => DOWN - HALF + 2 * HALF * fraction(v, lo, hi);
  const glow = theme.glow ? 'url(#glow-mark)' : undefined;
  const textGlow = theme.glow ? 'url(#glow-text)' : undefined;
  const text = props.format ?? ((v: number) => v.toFixed(decimals));
  const start = DOWN - HALF;
  const end = DOWN + HALF;
  const warnHigh = redline !== undefined && redline < hi;
  const warnLowEnd = warnLow !== undefined && warnLow > lo;
  const warnTick = (a: number) => radial(`w${String(a)}`, R + 3, R - 9, a);

  const endText = [lo, hi].map((v) => String(Number(v.toFixed(2))));
  const endSize = Math.max(...endText.map((t) => t.length)) > 3 ? 14 : 18;

  const needleAngle = angle(Math.min(hi, Math.max(lo, value ?? lo)));
  const [nx0, ny0] = polar(CX, CY, NEEDLE_IN, needleAngle);
  const [nx1, ny1] = polar(CX, CY, NEEDLE_OUT, needleAngle);

  return (
    <svg
      viewBox={`0 0 ${String(GAUGE_WIDTH)} ${String(GAUGE_HEIGHT)}`}
      role="img"
      aria-label={`${label} ${value === null ? 'no reading' : text(value)} ${unit}`}
      className="gauge"
    >
      <g filter={glow} fill="none" stroke={theme.mark}>
        <SmallScale colour={theme.mark} />
        <g stroke={theme.red} strokeWidth={4.5}>
          {warnLowEnd ? warnTick(start - WARN_OFFSET) : null}
          {warnHigh ? warnTick(end + WARN_OFFSET) : null}
        </g>
      </g>

      {/* The gauge's symbol (or its name, if it has none) sits inside the arc */}
      {hasIcon(props.id) ? (
        <g>
          <g filter={glow}>
            <GaugeIcon
              id={props.id}
              x={CX}
              y={SMALL_LAYOUT.labelY - 10}
              colour={theme.mark}
              scale={1.4}
            />
          </g>
          {props.id === 'boost' || props.id === 'boostMap' ? (
            <text
              x={CX}
              y={SMALL_LAYOUT.labelY - 27}
              textAnchor="middle"
              className="gauge-label"
              fontSize={10}
              fontWeight={700}
              letterSpacing={0.4}
              fill={theme.mark}
              filter={textGlow}
            >
              TURBO
            </text>
          ) : null}
        </g>
      ) : (
        <text
          x={CX}
          y={SMALL_LAYOUT.labelY}
          textAnchor="middle"
          className="gauge-label"
          fontSize={10.5}
          fontWeight={700}
          letterSpacing={0.4}
          fill={theme.mark}
          filter={textGlow}
        >
          {label}
        </text>
      )}

      <g
        filter={textGlow}
        className="dial-number"
        fontWeight={600}
        fill={theme.mark}
        fontSize={endSize}
      >
        <text x={fmt(SMALL_LAYOUT.leftEndX)} y={fmt(SMALL_LAYOUT.endBaseline)} textAnchor="end">
          {endText[0]}
        </text>
        <text x={fmt(SMALL_LAYOUT.rightEndX)} y={fmt(SMALL_LAYOUT.endBaseline)} textAnchor="start">
          {endText[1]}
        </text>
      </g>

      {/* Cyan bar reaching from inside the arc to just past it, pointing at the hidden pivot */}
      <line
        x1={fmt(nx0)}
        y1={fmt(ny0)}
        x2={fmt(nx1)}
        y2={fmt(ny1)}
        stroke={theme.needle}
        strokeWidth={5}
        opacity={value === null ? 0.25 : 1}
        filter={theme.glow ? 'url(#glow-needle)' : undefined}
      />
    </svg>
  );
}

/**
 * The scale of a small gauge: the segmented arc with its ticks, so callers can light it in
 * any colour.
 */
export function SmallScale({ colour }: { readonly colour: string }) {
  const start = DOWN - HALF;
  const segment = (2 * HALF) / SEGMENTS;
  const segments = Array.from({ length: SEGMENTS }, (_, i) => {
    const a0 = start + i * segment + (i === 0 ? 0 : GAP / 2);
    const a1 = start + (i + 1) * segment - (i === SEGMENTS - 1 ? 0 : GAP / 2);
    return <path key={`s${String(i)}`} d={arcPath(CX, CY, R, a0, a1)} />;
  });
  const ticks = Array.from({ length: SEGMENTS + 1 }, (_, i) => {
    const a = start + i * segment;
    const length = i === 0 || i === SEGMENTS ? END_TICK : MID_TICK;
    return radial(`t${String(i)}`, R + BAND / 2, R - length, a);
  });
  return (
    <g fill="none" stroke={colour}>
      <g strokeWidth={BAND}>{segments}</g>
      <g strokeWidth={3.5}>{ticks}</g>
    </g>
  );
}

function radial(key: string, r0: number, r1: number, a: number) {
  const [x0, y0] = polar(CX, CY, r0, a);
  const [x1, y1] = polar(CX, CY, r1, a);
  return <line key={key} x1={fmt(x0)} y1={fmt(y0)} x2={fmt(x1)} y2={fmt(y1)} />;
}

function tickStep(lo: number, hi: number): number {
  const [a, b] = niceTicks(lo, hi, 5);
  return a !== undefined && b !== undefined ? b - a : Math.max(1, hi - lo);
}
