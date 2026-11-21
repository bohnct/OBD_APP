import { arcPath, fmt, fraction, polar } from './geometry';
import { GAUGE_HEIGHT, GAUGE_WIDTH, type GaugeProps } from './types';
import { compactNumber } from '../units';

const R = 64;
const START = 225;
const SWEEP = 270;
const TRACK = 4;

/**
 * Styled after the 2016 Impreza centre console: a glowing red ring like the climate
 * knobs, the reading in large orange-red figures, and a lit arc that fills to the value.
 */
export function ConsoleGauge(props: GaugeProps) {
  const { theme, label, unit, lo, hi, value, decimals, redline, warnLow } = props;
  const cx = GAUGE_WIDTH / 2;
  const cy = 88;
  const angle = (v: number) => START - SWEEP * fraction(v, lo, hi);
  const glow = theme.glow ? 'url(#glow-mark)' : undefined;
  const textGlow = theme.glow ? 'url(#glow-text)' : undefined;
  const end = angle(hi);
  const at = angle(value ?? lo);
  const [mx0, my0] = polar(cx, cy, R - 7, at);
  const [mx1, my1] = polar(cx, cy, R + 7, at);

  return (
    <svg
      viewBox={`0 0 ${String(GAUGE_WIDTH)} ${String(GAUGE_HEIGHT)}`}
      role="img"
      aria-label={`${label} ${value === null ? 'no reading' : (props.format ?? ((v: number) => v.toFixed(decimals)))(value)} ${unit}`}
      className="gauge"
    >
      {/* Knob face and its lit ring */}
      <circle cx={cx} cy={cy} r={R + 18} fill={theme.cap} />
      <circle
        cx={cx}
        cy={cy}
        r={R + 15}
        fill="none"
        stroke={theme.ring}
        strokeWidth={5}
        filter={glow}
      />
      <circle cx={cx} cy={cy} r={R + 11} fill="none" stroke={theme.line} strokeWidth={1.5} />

      {/* Track, then the lit part of the arc: same radius, width and ends */}
      <path
        d={arcPath(cx, cy, R, START, end)}
        fill="none"
        stroke={theme.line}
        strokeWidth={TRACK}
      />
      {value === null || at >= START - 0.5 ? null : (
        <path
          d={arcPath(cx, cy, R, START, at)}
          fill="none"
          stroke={theme.needle}
          strokeWidth={TRACK}
          filter={glow}
        />
      )}
      {redline !== undefined && redline < hi ? (
        <path
          d={arcPath(cx, cy, R, angle(redline), end)}
          fill="none"
          stroke={theme.red}
          strokeWidth={TRACK + 1}
          filter={glow}
        />
      ) : null}
      {warnLow !== undefined && warnLow > lo ? (
        <path
          d={arcPath(cx, cy, R, START, angle(Math.min(warnLow, hi)))}
          fill="none"
          stroke={theme.red}
          strokeWidth={TRACK + 1}
          filter={glow}
        />
      ) : null}

      {/* Position marker */}
      {value === null ? null : (
        <line
          x1={fmt(mx0)}
          y1={fmt(my0)}
          x2={fmt(mx1)}
          y2={fmt(my1)}
          stroke="#fff4ec"
          strokeWidth={3}
          strokeLinecap="round"
          filter={theme.glow ? 'url(#glow-needle)' : undefined}
        />
      )}

      {/* Scale ends, like the − and + on the fan knob */}
      <g filter={textGlow}>
        <EndLabel cx={cx} cy={cy} a={START} text={compactNumber(lo)} color={theme.sub} />
        <EndLabel cx={cx} cy={cy} a={end} text={compactNumber(hi)} color={theme.sub} />
      </g>

      <text
        x={cx}
        y={cy - 22}
        textAnchor="middle"
        className="gauge-label"
        fontSize={11}
        letterSpacing={0.8}
        fill={theme.sub}
        filter={textGlow}
      >
        {label}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        className="gauge-value"
        fontSize={32}
        fill={theme.mark}
        filter={textGlow}
      >
        {value === null ? '—' : (props.format ?? ((v: number) => v.toFixed(decimals)))(value)}
      </text>
      <text
        x={cx}
        y={cy + 32}
        textAnchor="middle"
        className="gauge-label"
        fontSize={12}
        fill={theme.sub}
        filter={textGlow}
      >
        {unit}
      </text>
    </svg>
  );
}

interface EndLabelProps {
  readonly cx: number;
  readonly cy: number;
  readonly a: number;
  readonly text: string;
  readonly color: string;
}

function EndLabel({ cx, cy, a, text, color }: EndLabelProps) {
  const [x, y] = polar(cx, cy, R - 15, a);
  return (
    <text
      x={fmt(x)}
      y={fmt(y + 4)}
      textAnchor="middle"
      className="dial-number"
      fontSize={11}
      fill={color}
    >
      {text}
    </text>
  );
}
