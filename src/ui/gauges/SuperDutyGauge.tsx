import { useId, type ReactElement } from 'react';
import { niceTicks } from '../units';
import { arcPath, fmt, fraction, polar } from './geometry';
import { DIAL_CENTRE } from './superDutyLayout';
import { GAUGE_HEIGHT, GAUGE_WIDTH, type GaugeProps } from './types';

const R = 74;
/** Measured from the 2017+ Super Duty cluster: zero sits low-left, the top end low-right. */
const START = 221;
const SWEEP = 254;
const MAJOR_LENGTH = 13;
const MINOR_LENGTH = 7;
const SCALE_WIDTH = 3;
const RED_WIDTH = 4.5;

/**
 * A dial in the style of the 2017+ Ford Super Duty analog cluster: a bright white scale
 * line that runs only over the sweep (open at the bottom), long and short ticks pointing
 * inward from it, large bold numbers inside the ticks, an orange line that takes over the
 * scale through the red zone, and a thin cyan needle that fades into a dark hub.
 */
export function SuperDutyGauge(props: GaugeProps) {
  const { theme, label, unit, value, decimals, redline, warnLow } = props;
  const gradientId = `sd-needle-${useId().replace(/:/g, '')}`;
  // The dial starts and ends on a numbered tick, so stretch the scale to round values.
  const step = tickStep(props.lo, props.hi);
  const lo = Math.floor(props.lo / step) * step;
  const hi = Math.ceil(props.hi / step) * step;
  const { cx, cy } = DIAL_CENTRE;
  const angle = (v: number) => START - SWEEP * fraction(v, lo, hi);
  const glow = theme.glow ? 'url(#glow-mark)' : undefined;
  const textGlow = theme.glow ? 'url(#glow-text)' : undefined;
  const text = props.format ?? ((v: number) => v.toFixed(decimals));

  const redFrom = redline !== undefined && redline < hi ? redline : hi;
  const lowTo = warnLow !== undefined && warnLow > lo ? Math.min(warnLow, redFrom) : lo;
  const inRed = (v: number) => v > redFrom || v < lowTo;
  const tickColor = (v: number) => (inRed(v) ? theme.red : theme.mark);

  const majors = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  // Four-digit scales (EGT, DPF temperature) step the numbers down so they clear the ticks.
  const numberSize =
    Math.max(...majors.map((v) => String(Number(v.toFixed(2))).length)) > 3 ? 14 : 17;
  const ticks: ReactElement[] = [];
  const numbers: ReactElement[] = [];
  majors.forEach((v, k) => {
    ticks.push(radial(`M${String(k)}`, cx, cy, R, R - MAJOR_LENGTH, angle(v), tickColor(v), 3));
    const [tx, ty] = polar(cx, cy, R - 25, angle(v));
    numbers.push(
      <text
        key={`n${String(k)}`}
        x={fmt(tx)}
        y={fmt(ty + numberSize * 0.35)}
        textAnchor="middle"
        className="dial-number"
        fontSize={numberSize}
        fontWeight={700}
        fill={theme.mark}
      >
        {Number(v.toFixed(2))}
      </text>,
    );
    if (k < majors.length - 1) {
      const mv = v + step / 2;
      ticks.push(
        radial(`m${String(k)}`, cx, cy, R, R - MINOR_LENGTH, angle(mv), tickColor(mv), 2.2),
      );
    }
  });

  const needleAngle = angle(value ?? lo);
  const tip = R - 6;

  return (
    <svg
      viewBox={`0 0 ${String(GAUGE_WIDTH)} ${String(GAUGE_HEIGHT)}`}
      role="img"
      aria-label={`${label} ${value === null ? 'no reading' : text(value)} ${unit}`}
      className="gauge"
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={cx}
          y1={cy}
          x2={cx + tip}
          y2={cy}
        >
          <stop offset="0" stopColor={theme.needle} stopOpacity={0.15} />
          <stop offset="0.45" stopColor={theme.needle} stopOpacity={0.85} />
          <stop offset="1" stopColor={theme.needle} />
        </linearGradient>
      </defs>

      {/* Dark face, open at the bottom like the real dial */}
      <circle cx={cx} cy={cy} r={R + 8} fill={theme.cap} />

      {/* Scale line: white over the normal range, orange through the warning zones */}
      <g filter={glow} fill="none" strokeLinecap="butt">
        {lowTo > lo ? (
          <path
            d={arcPath(cx, cy, R, angle(lo), angle(lowTo))}
            stroke={theme.red}
            strokeWidth={RED_WIDTH}
          />
        ) : null}
        <path
          d={arcPath(cx, cy, R, angle(lowTo), angle(redFrom))}
          stroke={theme.ring}
          strokeWidth={SCALE_WIDTH}
        />
        {redFrom < hi ? (
          <path
            d={arcPath(cx, cy, R, angle(redFrom), angle(hi))}
            stroke={theme.red}
            strokeWidth={RED_WIDTH}
          />
        ) : null}
        {ticks}
      </g>
      <g filter={textGlow}>{numbers}</g>

      <text
        x={cx}
        y={cy + 21}
        textAnchor="middle"
        className="gauge-label"
        fontSize={9.5}
        fontWeight={600}
        letterSpacing={0.5}
        fill={theme.sub}
        filter={textGlow}
      >
        {label}
      </text>
      <text
        x={cx}
        y={cy + 62}
        textAnchor="middle"
        className="gauge-value"
        fontSize={18}
        fill={theme.mark}
        filter={textGlow}
      >
        {value === null ? '—' : text(value)}
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
          points={`${fmt(cx)},${fmt(cy - 2.6)} ${fmt(cx + tip)},${fmt(cy - 1)} ${fmt(cx + tip)},${fmt(cy + 1)} ${fmt(cx)},${fmt(cy + 2.6)}`}
          fill={`url(#${gradientId})`}
          filter={theme.glow ? 'url(#glow-needle)' : undefined}
        />
      </g>
      {/* Small dark hub; the needle fades into it rather than ending at a bright cap */}
      <circle cx={cx} cy={cy} r={9} fill={theme.cap} />
    </svg>
  );
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

/**
 * The bare scale of a main dial: the line over the sweep with long and short ticks and no
 * numbers, so callers can light it in any colour.
 */
export function DialScale({
  colour,
  divisions = 5,
}: {
  readonly colour: string;
  readonly divisions?: number;
}) {
  const { cx, cy } = DIAL_CENTRE;
  const at = (f: number) => START - SWEEP * f;
  const ticks: ReactElement[] = [];
  for (let i = 0; i <= divisions * 2; i++) {
    const major = i % 2 === 0;
    ticks.push(
      radial(
        `d${String(i)}`,
        cx,
        cy,
        R,
        R - (major ? MAJOR_LENGTH : MINOR_LENGTH),
        at(i / (divisions * 2)),
        colour,
        major ? 3 : 2.2,
      ),
    );
  }
  return (
    <g fill="none">
      <path d={arcPath(cx, cy, R, at(0), at(1))} stroke={colour} strokeWidth={SCALE_WIDTH} />
      {ticks}
    </g>
  );
}
