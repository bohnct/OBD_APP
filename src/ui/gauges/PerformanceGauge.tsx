import type { ReactElement } from 'react';
import { niceTicks } from '../units';
import { arcPath, fmt, fraction, polar } from './geometry';
import { GAUGE_HEIGHT, GAUGE_WIDTH, type GaugeProps } from './types';

const R = 70;
const START = 225;
const SWEEP = 270;
const MINORS = 5;

/**
 * An aftermarket performance gauge: black face and bezel, full 270° sweep, markings lit
 * through the dial in the chosen backlight colour, a fluorescent red pointer, and a digital
 * readout. Past the red line the whole dial lights up in the warning colour and flashes.
 */
export function PerformanceGauge(props: GaugeProps) {
  const { theme, label, unit, value, decimals, redline, warnLow } = props;
  // Start and end on a numbered tick.
  const [t0, t1] = niceTicks(props.lo, props.hi, 5);
  const step = t0 !== undefined && t1 !== undefined ? t1 - t0 : Math.max(1, props.hi - props.lo);
  const lo = Math.floor(props.lo / step) * step;
  const hi = Math.ceil(props.hi / step) * step;
  const cx = GAUGE_WIDTH / 2;
  const cy = 88;
  const angle = (v: number) => START - SWEEP * fraction(v, lo, hi);
  const glow = theme.glow ? 'url(#glow-mark)' : undefined;
  const textGlow = theme.glow ? 'url(#glow-text)' : undefined;
  const inRed = (v: number) =>
    (redline !== undefined && v >= redline) || (warnLow !== undefined && v <= warnLow);
  const warning = value !== null && inRed(value);
  const majors = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

  const ticks: ReactElement[] = [];
  const numbers: ReactElement[] = [];
  majors.forEach((v, k) => {
    const red = inRed(v);
    const color = red ? theme.red : theme.mark;
    ticks.push(radial(`M${String(k)}`, cx, cy, R - 1, R - 11, angle(v), color, 2.4));
    const [tx, ty] = polar(cx, cy, R - 23, angle(v));
    numbers.push(
      <text
        key={`n${String(k)}`}
        x={fmt(tx)}
        y={fmt(ty + 4.5)}
        textAnchor="middle"
        className="dial-number"
        fontSize={13}
        fill={color}
        filter={textGlow}
      >
        {Number(v.toFixed(2))}
      </text>,
    );
    if (k === majors.length - 1) return;
    for (let j = 1; j < MINORS; j++) {
      const mv = v + (step * j) / MINORS;
      const mred = inRed(mv);
      ticks.push(
        radial(
          `m${String(k)}-${String(j)}`,
          cx,
          cy,
          R - 1,
          R - 6,
          angle(mv),
          mred ? theme.red : theme.sub,
          1.3,
        ),
      );
    }
  });

  const needleAngle = angle(value ?? lo);

  return (
    <svg
      viewBox={`0 0 ${String(GAUGE_WIDTH)} ${String(GAUGE_HEIGHT)}`}
      role="img"
      aria-label={`${label} ${value === null ? 'no reading' : (props.format ?? ((v: number) => v.toFixed(decimals)))(value)} ${unit}${warning ? ', warning' : ''}`}
      className="gauge"
    >
      {/* Black bezel and face */}
      <circle cx={cx} cy={cy} r={R + 12} fill={theme.ring} />
      <circle cx={cx} cy={cy} r={R + 12} fill="none" stroke="#2e2e32" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={R + 6} fill={theme.cap} />
      {warning ? (
        <circle className="warn-flash" cx={cx} cy={cy} r={R + 6} fill={theme.red} />
      ) : null}

      {redline !== undefined && redline < hi ? (
        <path
          d={arcPath(cx, cy, R + 2, angle(redline), angle(hi))}
          fill="none"
          stroke={theme.red}
          strokeWidth={3}
          filter={glow}
        />
      ) : null}
      {warnLow !== undefined && warnLow > lo ? (
        <path
          d={arcPath(cx, cy, R + 2, angle(lo), angle(Math.min(warnLow, hi)))}
          fill="none"
          stroke={theme.red}
          strokeWidth={3}
          filter={glow}
        />
      ) : null}
      <g filter={glow}>{ticks}</g>
      {numbers}

      <text
        x={cx}
        y={cy - 22}
        textAnchor="middle"
        className="gauge-label"
        fontSize={10}
        letterSpacing={1}
        fill={theme.sub}
        filter={textGlow}
      >
        {label}
      </text>

      {/* Digital readout */}
      <rect
        x={cx - 28}
        y={cy + 38}
        width={56}
        height={20}
        rx={3}
        fill="#000"
        stroke={theme.line}
        strokeWidth={1}
      />
      <text
        x={cx}
        y={cy + 53}
        textAnchor="middle"
        className="gauge-value"
        fontSize={14}
        fill={warning ? theme.red : theme.mark}
        filter={textGlow}
      >
        {value === null ? '—' : (props.format ?? ((v: number) => v.toFixed(decimals)))(value)}
      </text>
      <text
        x={cx}
        y={cy + 70}
        textAnchor="middle"
        className="gauge-label"
        fontSize={9.5}
        fill={theme.sub}
        filter={textGlow}
      >
        {unit}
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
          points={`${fmt(cx - 16)},${fmt(cy - 2.5)} ${fmt(cx + R - 4)},${fmt(cy - 1)} ${fmt(cx + R - 4)},${fmt(cy + 1)} ${fmt(cx - 16)},${fmt(cy + 2.5)}`}
          fill={theme.needle}
          filter={theme.glow ? 'url(#glow-needle)' : undefined}
        />
      </g>
      <circle cx={cx} cy={cy} r={9} fill="#0b0b0c" stroke="#2e2e32" strokeWidth={1.5} />
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
