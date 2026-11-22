import type { ReactElement } from 'react';
import { niceTicks } from '../units';
import { arcPath, fmt, fraction, polar } from './geometry';
import { GAUGE_HEIGHT, GAUGE_WIDTH, type GaugeProps } from './types';

const R = 70;
const START = 215;
const SWEEP = 250;
/** Minor divisions between numbered ticks; the middle one is drawn longer. */
const DIVISIONS = 10;
const RED_BAND = 6;

/**
 * A round dial in the style of the 2012-16 Subaru Impreza cluster: thin bright bezel,
 * dense white ticks, a red band along the edge for the red zone, a plain white needle
 * and a large black centre hub. The label sits above the hub, the reading below.
 *
 * With a theme `face` (the Subaru by day) the scale sits on a slate-blue band, the centre
 * is dark inside a shiny blue ring, and the red zone is split into blocks at each half step.
 */
export function RoundGauge(props: GaugeProps) {
  const { theme, label, unit, value, decimals, redline, warnLow } = props;
  // Round dials start and end on a numbered tick, so stretch the scale to round values.
  const step = tickStep(props.lo, props.hi);
  const lo = Math.floor(props.lo / step) * step;
  const hi = Math.ceil(props.hi / step) * step;
  const cx = GAUGE_WIDTH / 2;
  const cy = 90;
  const angle = (v: number) => START - SWEEP * fraction(v, lo, hi);
  const glow = theme.glow ? 'url(#glow-mark)' : undefined;
  const textGlow = theme.glow ? 'url(#glow-text)' : undefined;
  const majors = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const inRed = (v: number) =>
    (redline !== undefined && v >= redline) || (warnLow !== undefined && v <= warnLow);
  const tickColor = (v: number) => (inRed(v) ? theme.red : theme.mark);

  const face = theme.face ?? null; // Subaru by day
  // Subaru by day: in the red zone a red bar takes the place of the small ticks.
  const redBar = face !== null && redline !== undefined && redline < hi ? redline : null;
  const ticks: ReactElement[] = [];
  const numbers: ReactElement[] = [];
  majors.forEach((v, k) => {
    ticks.push(radial(`M${String(k)}`, cx, cy, R, R - 10, angle(v), tickColor(v), 2.6));
    const [tx, ty] = polar(cx, cy, R - 21, angle(v));
    numbers.push(
      <text
        key={`n${String(k)}`}
        x={fmt(tx)}
        y={fmt(ty + 4.5)}
        textAnchor="middle"
        className="dial-number"
        fontSize={13.5}
        fill={tickColor(v)}
      >
        {Number(v.toFixed(2))}
      </text>,
    );
    if (k === majors.length - 1) return;
    for (let j = 1; j < DIVISIONS; j++) {
      const mv = v + (step * j) / DIVISIONS;
      const half = j === DIVISIONS / 2;
      if (!half && redBar !== null && mv > redBar) continue;
      ticks.push(
        radial(
          `m${String(k)}-${String(j)}`,
          cx,
          cy,
          R,
          // Half ticks in the red bar reach past its inner edge, like the numbered ones.
          R - (half ? (redBar !== null && mv > redBar ? 9.5 : 7) : 4.5),
          angle(mv),
          tickColor(mv),
          half ? 1.8 : 1.1,
        ),
      );
    }
  });

  const needleAngle = angle(value ?? lo);

  return (
    <svg
      viewBox={`0 0 ${String(GAUGE_WIDTH)} ${String(GAUGE_HEIGHT)}`}
      role="img"
      aria-label={`${label} ${value === null ? 'no reading' : (props.format ?? ((v: number) => v.toFixed(decimals)))(value)} ${unit}`}
      className="gauge"
    >
      {/* Face, dark bezel band and thin bright outer ring */}
      <circle cx={cx} cy={cy} r={R + 11} fill={theme.cap} />
      {face ? (
        <>
          {/* Slate-blue band under the scale, dark centre, and the shiny blue ring between */}
          <circle cx={cx} cy={cy} r={R + 4} fill={face.band} />
          <circle cx={cx} cy={cy} r={INNER_R} fill={face.centre} />
          <circle cx={cx} cy={cy} r={INNER_R} fill="none" stroke={face.ring} strokeWidth={1.6} />
        </>
      ) : null}
      <circle cx={cx} cy={cy} r={R + 6} fill="none" stroke={theme.line} strokeWidth={4} />
      <circle
        cx={cx}
        cy={cy}
        r={R + 10}
        fill="none"
        stroke={theme.ring}
        strokeWidth={theme.ringWidth}
        filter={glow}
      />

      {redBar !== null ? (
        // Red blocks set in from the edge, broken where each numbered and half tick crosses.
        <g filter={glow}>
          {redBlocks(redBar, hi, step, lo).map(([from, to]) => (
            <path
              key={from}
              d={arcPath(
                cx,
                cy,
                RED_BAR.radius,
                angle(from) - RED_BAR.gap,
                angle(to) + RED_BAR.gap,
              )}
              fill="none"
              stroke={theme.red}
              strokeWidth={RED_BAR.width}
            />
          ))}
        </g>
      ) : null}
      {!face && redline !== undefined && redline < hi ? (
        <path
          d={arcPath(cx, cy, R - RED_BAND / 2, angle(redline), angle(hi))}
          fill="none"
          stroke={theme.red}
          strokeWidth={RED_BAND}
          filter={glow}
        />
      ) : null}
      {warnLow !== undefined && warnLow > lo ? (
        <path
          d={arcPath(cx, cy, R - RED_BAND / 2, angle(lo), angle(Math.min(warnLow, hi)))}
          fill="none"
          stroke={theme.red}
          strokeWidth={RED_BAND}
          filter={glow}
        />
      ) : null}
      <g filter={glow}>{ticks}</g>
      <g filter={textGlow}>{numbers}</g>

      <text
        x={cx}
        y={face ? cy - 19 : cy - 24}
        textAnchor="middle"
        className="gauge-label"
        fontSize={face ? 8.5 : 10}
        letterSpacing={0.6}
        fill={theme.sub}
        filter={textGlow}
      >
        {label}
      </text>
      <text
        x={cx}
        y={face ? cy + 31 : cy + 42}
        textAnchor="middle"
        className="gauge-value"
        fontSize={face ? 16 : 18}
        fill={theme.mark}
        filter={textGlow}
      >
        {value === null ? '—' : (props.format ?? ((v: number) => v.toFixed(decimals)))(value)}
        <tspan fontSize={10.5} fill={theme.sub}>
          {' '}
          {unit}
        </tspan>
      </text>

      <g
        className="needle"
        style={{
          transform: `rotate(${fmt(-needleAngle)}deg)`,
          transformOrigin: `${String(cx)}px ${String(cy)}px`,
        }}
        opacity={value === null ? 0.25 : 1}
      >
        <polygon
          points={`${fmt(cx)},${fmt(cy - 3.2)} ${fmt(cx + R - 3)},${fmt(cy - 1.1)} ${fmt(cx + R - 3)},${fmt(cy + 1.1)} ${fmt(cx)},${fmt(cy + 3.2)}`}
          fill={theme.needle}
          filter={theme.glow ? 'url(#glow-needle)' : undefined}
        />
      </g>
      {/* Large recessed centre hub */}
      <circle cx={cx} cy={cy} r={15} fill="#030304" stroke={theme.line} strokeWidth={2} />
    </svg>
  );
}

/** Radius of the shiny blue ring that rims the Subaru's dark centre. */
const INNER_R = 38;

/**
 * The Subaru's red bar: its outside edge lines up with the outer ends of the ticks, and it
 * is narrower than a numbered tick, so the ticks reach past its inside edge. It has a small
 * gap either side of each numbered and half tick.
 */
const RED_BAR = { radius: R - 4.5 / 2, width: 4.5, gap: 2.4 } as const;

/** The red zone cut into blocks between the numbered and half ticks. */
function redBlocks(from: number, to: number, step: number, lo: number): [number, number][] {
  const half = step / 2;
  const blocks: [number, number][] = [];
  let start = from;
  let edge = lo + Math.floor((from - lo) / half + 1e-9) * half + half;
  while (start < to - 1e-9) {
    const end = Math.min(to, edge);
    blocks.push([start, end]);
    start = end;
    edge += half;
  }
  return blocks;
}

function radial(
  key: string,
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a: number,
  color: string,
  width: number,
) {
  const [x0, y0] = polar(cx, cy, r0, a);
  const [x1, y1] = polar(cx, cy, r1, a);
  return (
    <line
      key={key}
      x1={fmt(x0)}
      y1={fmt(y0)}
      x2={fmt(x1)}
      y2={fmt(y1)}
      stroke={color}
      strokeWidth={width}
    />
  );
}

function tickStep(lo: number, hi: number): number {
  const [a, b] = niceTicks(lo, hi, 5);
  return a !== undefined && b !== undefined ? b - a : Math.max(1, hi - lo);
}
