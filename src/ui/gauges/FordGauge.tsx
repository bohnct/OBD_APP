import { arcPath, fmt, fraction, polar } from './geometry';
import { GAUGE_HEIGHT, GAUGE_WIDTH, type GaugeProps } from './types';
import { compactNumber } from '../units';

const R = 80;
const ARC_WIDTH = 3;
const LONG_TICK = { length: 11, width: 3 };
const SHORT_TICK = { length: 7, width: 2.2 };
/** Half an end tick's width as an angle, so the tick sits flush with the arc's end. */
const END_INSET = (LONG_TICK.width / 2 / R) * (180 / Math.PI);
/** Where the end numbers sit: degrees in from the arc ends, and distance in from the arc. */
const END_LABEL = { top: { inset: 8, depth: 28 }, bottom: { inset: 9, depth: 26 } } as const;
const PIVOT_OFFSET = 28;
/** Reach of the warm bulb glow around the pivot at night. */
const BULB_RADIUS = 24;

/**
 * A 1992-97 Ford F-series style gauge: a flat arc with a few ticks, a "NORMAL" band,
 * a red end marker, and a tapered needle swinging from a pivot above (top row) or
 * below (bottom row).
 */
export function FordGauge(props: GaugeProps) {
  const { theme, label, unit, lo, hi, value, decimals, redline, warnLow, normal, variant } = props;
  const top = variant === 'top';
  const cx = GAUGE_WIDTH / 2;
  const cy = top ? PIVOT_OFFSET : GAUGE_HEIGHT - PIVOT_OFFSET;
  const a0 = top ? 208 : 152;
  const a1 = top ? 332 : 28;
  const dir = Math.sign(a1 - a0);
  const angle = (f: number) => a0 + (a1 - a0) * f;
  const tickCount = top ? 6 : 4;
  const glow = theme.glow ? 'url(#glow-mark)' : undefined;
  const textGlow = theme.glow ? 'url(#glow-text)' : undefined;
  const mark = theme.mark;

  const ticks = Array.from({ length: tickCount + 1 }, (_, k) => {
    const long = k === 0 || k === tickCount || k === tickCount / 2;
    const { length, width } = long ? LONG_TICK : SHORT_TICK;
    const inset = k === 0 ? END_INSET : k === tickCount ? -END_INSET : 0;
    const a = angle(k / tickCount) + inset * dir;
    const [x0, y0] = polar(cx, cy, R + ARC_WIDTH / 2, a);
    const [x1, y1] = polar(cx, cy, R - length, a);
    return (
      <line
        key={k}
        x1={fmt(x0)}
        y1={fmt(y0)}
        x2={fmt(x1)}
        y2={fmt(y1)}
        stroke={mark}
        strokeWidth={width}
      />
    );
  });

  const ends = ([0, 1] as const).map((f) => {
    const { inset, depth } = END_LABEL[variant];
    const a = angle(f) + (f === 0 ? inset : -inset) * dir;
    const [x, y] = polar(cx, cy, R - depth, a);
    return (
      <text
        key={f}
        x={fmt(x)}
        y={fmt(y + 5)}
        textAnchor="middle"
        className="gauge-end"
        fontSize={15}
        fill={mark}
      >
        {compactNumber(f === 0 ? lo : hi)}
      </text>
    );
  });

  // Like the real '95 modules: a red block just past the end of the scale marks a warning
  // zone at that end (high warning at the top end, low warning at the bottom end).
  const endMarker = (at: 0 | 1) => {
    const a = angle(at) + (at === 1 ? 6 : -6) * dir;
    const [x0, y0] = polar(cx, cy, R + 2, a);
    const [x1, y1] = polar(cx, cy, R - 9, a);
    return (
      <line
        key={`warn${String(at)}`}
        x1={fmt(x0)}
        y1={fmt(y0)}
        x2={fmt(x1)}
        y2={fmt(y1)}
        stroke={theme.red}
        strokeWidth={5}
      />
    );
  };
  const lowMarker = warnLow !== undefined && warnLow > lo ? endMarker(0) : null;
  const redMarker =
    redline !== undefined && redline < hi
      ? (() => {
          const a = angle(1) + 6 * dir;
          const [x0, y0] = polar(cx, cy, R + 2, a);
          const [x1, y1] = polar(cx, cy, R - 9, a);
          return (
            <line
              x1={fmt(x0)}
              y1={fmt(y0)}
              x2={fmt(x1)}
              y2={fmt(y1)}
              stroke={theme.red}
              strokeWidth={5}
            />
          );
        })()
      : null;

  const labelY = top ? cy + R * 0.62 : cy - R * 0.6;
  const needleAngle = angle(fraction(value ?? lo, lo, hi));

  return (
    <svg
      viewBox={`0 0 ${String(GAUGE_WIDTH)} ${String(GAUGE_HEIGHT)}`}
      role="img"
      aria-label={`${label} ${value === null ? 'no reading' : (props.format ?? ((v: number) => v.toFixed(decimals)))(value)} ${unit}`}
      className="gauge"
    >
      <g filter={glow}>
        <path d={arcPath(cx, cy, R, a0, a1)} fill="none" stroke={mark} strokeWidth={ARC_WIDTH} />
        {ticks}
        {redMarker}
        {lowMarker}
        {normal ? (
          <NormalBand
            cx={cx}
            cy={cy}
            top={top}
            from={angle(fraction(normal[0], lo, hi))}
            to={angle(fraction(normal[1], lo, hi))}
            color={mark}
            id={label}
          />
        ) : null}
      </g>
      <g filter={textGlow}>
        {ends}
        <text
          x={cx}
          y={fmt(labelY)}
          textAnchor="middle"
          className="gauge-label"
          fontSize={13}
          fill={mark}
        >
          {label}
        </text>
      </g>
      <text
        x={cx}
        y={fmt(labelY + 16)}
        textAnchor="middle"
        className="gauge-value"
        fontSize={12}
        fill={mark}
        filter={textGlow}
      >
        {value === null ? '—' : (props.format ?? ((v: number) => v.toFixed(decimals)))(value)}{' '}
        {unit}
      </text>

      {theme.glow ? (
        // Night lighting: the '95 needles are lit from a bulb under the pivot.
        <circle cx={cx} cy={cy} r={BULB_RADIUS} fill="url(#bulb-glow)" />
      ) : null}
      <g
        className="needle"
        style={{
          transform: `rotate(${fmt(-needleAngle)}deg)`,
          transformOrigin: `${String(cx)}px ${String(cy)}px`,
        }}
        opacity={value === null ? 0.25 : 1}
      >
        <path
          d={`M${fmt(cx - 4)},${fmt(cy - 4.5)} L${fmt(cx + R + 2)},${fmt(cy - 1.3)} Q${fmt(cx + R + 4)},${fmt(cy)} ${fmt(cx + R + 2)},${fmt(cy + 1.3)} L${fmt(cx - 4)},${fmt(cy + 4.5)} Z`}
          fill={theme.needle}
          filter={theme.glow ? 'url(#glow-needle)' : undefined}
        />
      </g>
      {/* Matte pivot cap */}
      <circle cx={cx} cy={cy} r={11.5} fill="#0a0a0a" stroke="#262626" strokeWidth={1.5} />
    </svg>
  );
}

interface BandProps {
  readonly cx: number;
  readonly cy: number;
  readonly top: boolean;
  readonly from: number;
  readonly to: number;
  readonly color: string;
  readonly id: string;
}

/** The outlined "NORMAL" strip that follows the arc. */
function NormalBand({ cx, cy, top, from, to, color, id }: BandProps) {
  const inner = R + 6;
  const outer = inner + 12;
  const [ax0, ay0] = polar(cx, cy, inner, from);
  const [ax1, ay1] = polar(cx, cy, outer, from);
  const [bx0, by0] = polar(cx, cy, inner, to);
  const [bx1, by1] = polar(cx, cy, outer, to);
  const pathId = `normal-${id.replace(/\W+/g, '-')}`;
  return (
    <g fill="none" stroke={color} strokeWidth={1.2}>
      <path d={arcPath(cx, cy, inner, from, to)} />
      <path d={arcPath(cx, cy, outer, from, to)} />
      <line x1={fmt(ax0)} y1={fmt(ay0)} x2={fmt(ax1)} y2={fmt(ay1)} />
      <line x1={fmt(bx0)} y1={fmt(by0)} x2={fmt(bx1)} y2={fmt(by1)} />
      <path id={pathId} d={arcPath(cx, cy, top ? inner + 9 : inner + 3, from, to)} stroke="none" />
      <text className="gauge-end" fontSize={9} letterSpacing={1.4} fill={color} stroke="none">
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          NORMAL
        </textPath>
      </text>
    </g>
  );
}
