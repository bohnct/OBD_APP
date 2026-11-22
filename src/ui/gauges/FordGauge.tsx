import { arcPath, fmt, fraction, polar } from './geometry';
import { GAUGE_HEIGHT, GAUGE_WIDTH, type GaugeProps } from './types';
import { compactNumber } from '../units';

const R = 80;
const ARC_WIDTH = 2.6;
/** Short ticks at the quarter marks, hanging in toward the pivot like the real fuel gauge. */
const TICK = { length: 7, width: 2.4 };
/** Small hook at each end of the arc, pointing in toward the pivot. */
const HOOK = 6;
/** End blocks sit just past the arc ends; the end labels sit further round, outside the arc. */
const BLOCK_OFFSET = 6;
const LABEL_OFFSET = 5;
const PIVOT_OFFSET = 28;
/** The large dark hub; the needle runs across it unlit. */
const CAP_RADIUS = 24;
const BULB_RADIUS = 34;
const AMBER = '#e9a24c';
/** The word NORMAL needs about 40° of arc; its path is made wider so it never clips. */
const NORMAL_HALF_SPAN = 40;
/** Keep the word's centre this far (fraction of the scale) from either end. */
const NORMAL_MARGIN = 0.28;
/** Width of the blocks past the arc ends; the needle's tip is the same width. */
const END_BLOCK = 5;
/** Half the needle's width where it leaves the hub (and across the hub, by day). */
const NEEDLE_HALF_WIDTH = 3.2;

/**
 * A 1992-97 Ford F-series gauge, after the owner's day and night photos: a thin arc with
 * short ticks at the quarters, a block just past each end (red at the warning end),
 * big end letters past the ends, "NORMAL" printed along the inside of the arc, and a
 * needle that crosses a large dark hub as a parallel bar and is lit only outside the hub.
 */
export function FordGauge(props: GaugeProps) {
  const { theme, label, unit, lo, hi, value, decimals, redline, warnLow, normal, variant } = props;
  const top = variant === 'top';
  const night = theme.glow;
  const cx = GAUGE_WIDTH / 2;
  const cy = top ? PIVOT_OFFSET : GAUGE_HEIGHT - PIVOT_OFFSET;
  const a0 = top ? 208 : 152;
  const a1 = top ? 332 : 28;
  const dir = Math.sign(a1 - a0);
  const angle = (f: number) => a0 + (a1 - a0) * f;
  const glow = night ? 'url(#glow-mark)' : undefined;
  const textGlow = night ? 'url(#glow-text)' : undefined;
  const mark = theme.mark;
  const text = props.format ?? ((v: number) => v.toFixed(decimals));
  // The symbols on the real cluster are lit amber at night; the names take their place here.
  const labelColour = night ? AMBER : theme.sub;

  const radial = (key: string, r0: number, r1: number, a: number, colour: string, w: number) => {
    const [x0, y0] = polar(cx, cy, r0, a);
    const [x1, y1] = polar(cx, cy, r1, a);
    return (
      <line
        key={key}
        x1={fmt(x0)}
        y1={fmt(y0)}
        x2={fmt(x1)}
        y2={fmt(y1)}
        stroke={colour}
        strokeWidth={w}
        strokeLinecap="round"
      />
    );
  };
  // Like the real cluster: gauges with a NORMAL band have no quarter ticks (oil, coolant,
  // volts); the others do (fuel).
  const ticks = (normal ? [] : [0.25, 0.5, 0.75]).map((f) =>
    radial(`t${String(f)}`, R, R - TICK.length, angle(f), mark, TICK.width),
  );
  const hooks = [0, 1].map((f) => radial(`h${String(f)}`, R, R - HOOK, angle(f), mark, ARC_WIDTH));
  const warnStart = warnLow !== undefined && warnLow > lo;
  const warnEnd = redline !== undefined && redline < hi;
  const blocks = ([0, 1] as const).map((f) => {
    const a = angle(f) + (f === 0 ? -BLOCK_OFFSET : BLOCK_OFFSET) * dir;
    const red = f === 0 ? warnStart : warnEnd;
    return radial(`b${String(f)}`, R - 9, R - 1, a, red ? theme.red : mark, END_BLOCK);
  });

  const ends = ([0, 1] as const).map((f) => {
    const a = angle(f) + (f === 0 ? -LABEL_OFFSET : LABEL_OFFSET) * dir;
    const [x, y] = polar(cx, cy, R - 25, a);
    return (
      <text
        key={f}
        x={fmt(x)}
        y={fmt(y + 6)}
        textAnchor="middle"
        className="gauge-end"
        fontSize={18}
        fontWeight={700}
        fill={mark}
      >
        {compactNumber(f === 0 ? lo : hi)}
      </text>
    );
  });

  // "NORMAL" follows the inside of the arc over the normal range.
  const normalId = `normal-${label.replace(/\W+/g, '-')}-${variant}`;
  let normalText = null;
  if (normal) {
    // Centred on the normal range, but laid on a path long enough for the whole word even when
    // that range is narrow, and kept clear of the arc ends.
    const middle = (fraction(normal[0], lo, hi) + fraction(normal[1], lo, hi)) / 2;
    const centre = angle(Math.min(1 - NORMAL_MARGIN, Math.max(NORMAL_MARGIN, middle)));
    const from = centre - NORMAL_HALF_SPAN * dir;
    const to = centre + NORMAL_HALF_SPAN * dir;
    // Printed on the pivot side of the line, like everything else on these gauges.
    const r = top ? R - 4 : R - 14;
    normalText = (
      <>
        <path id={normalId} d={arcPath(cx, cy, r, from, to)} fill="none" stroke="none" />
        <text className="gauge-end" fontSize={10} letterSpacing={1.6} fill={mark}>
          <textPath href={`#${normalId}`} startOffset="50%" textAnchor="middle">
            NORMAL
          </textPath>
        </text>
      </>
    );
  }

  const labelY = top ? cy + R * 0.55 : cy - R * 0.55;
  const valueY = labelY + 14;
  const needleAngle = angle(fraction(value ?? lo, lo, hi));

  return (
    <svg
      viewBox={`0 0 ${String(GAUGE_WIDTH)} ${String(GAUGE_HEIGHT)}`}
      role="img"
      aria-label={`${label} ${value === null ? 'no reading' : text(value)} ${unit}`}
      className="gauge"
    >
      <g filter={glow}>
        <path d={arcPath(cx, cy, R, a0, a1)} fill="none" stroke={mark} strokeWidth={ARC_WIDTH} />
        {hooks}
        {ticks}
        {blocks}
      </g>
      <g filter={textGlow}>
        {ends}
        {normalText}
        <text
          x={cx}
          y={fmt(labelY)}
          textAnchor="middle"
          className="gauge-label"
          fontSize={12}
          fontWeight={600}
          fill={labelColour}
        >
          {label}
        </text>
        <text
          x={cx}
          y={fmt(valueY)}
          textAnchor="middle"
          className="gauge-value"
          fontSize={12}
          fill={mark}
        >
          {value === null ? '—' : text(value)} {unit}
        </text>
      </g>

      {/* Night: warm light from the bulb behind the hub */}
      {night ? <circle cx={cx} cy={cy} r={BULB_RADIUS} fill="url(#bulb-glow)" /> : null}
      <circle
        cx={cx}
        cy={cy}
        r={CAP_RADIUS}
        fill={theme.cap}
        stroke={night ? '#0c0d0c' : '#2b2b2b'}
        strokeWidth={1.5}
      />
      <g
        className="needle"
        style={{
          transform: `rotate(${fmt(-needleAngle)}deg)`,
          transformOrigin: `${String(cx)}px ${String(cy)}px`,
        }}
        opacity={value === null ? 0.25 : 1}
      >
        <path
          d={`M${fmt(cx + CAP_RADIUS - 1)},${fmt(cy - NEEDLE_HALF_WIDTH)} L${fmt(cx + R)},${fmt(cy - END_BLOCK / 2)} L${fmt(cx + R)},${fmt(cy + END_BLOCK / 2)} L${fmt(cx + CAP_RADIUS - 1)},${fmt(cy + NEEDLE_HALF_WIDTH)} Z`}
          fill={theme.needle}
          filter={night ? 'url(#glow-needle)' : undefined}
        />
      </g>
      {/* By day the needle shows as a parallel bar right across the hub; at night that part
          is unlit and can't be seen, so only the pointer outside the hub shows. */}
      {night ? null : (
        <g
          style={{
            transform: `rotate(${fmt(-needleAngle)}deg)`,
            transformOrigin: `${String(cx)}px ${String(cy)}px`,
          }}
          opacity={value === null ? 0.25 : 1}
        >
          <rect
            x={fmt(cx - CAP_RADIUS)}
            y={fmt(cy - NEEDLE_HALF_WIDTH)}
            width={2 * CAP_RADIUS}
            height={2 * NEEDLE_HALF_WIDTH}
            fill={theme.needle}
          />
        </g>
      )}
    </svg>
  );
}
