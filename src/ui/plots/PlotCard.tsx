import { useId } from 'react';
import { history } from '../../history/history';
import type { Parameter } from '../../profiles/schema';
import type { GaugeTheme } from '../theme/themes';
import { GlowFilter } from '../gauges/GlowFilter';
import { inWarning, useDisplayParameter } from '../useDisplayParameter';
import { decimate, rangeTicks, stableRange, type PlotRange } from './plotMath';

const W = 400;
const H = 140;
/** The trace area. Room on the left for the scale, on the right for the pointer. */
const AREA = { left: 46, right: 382, top: 34, bottom: 118 };
/** The trace starts this far right of the scale, so it never runs into the tick marks. */
const TRACE_GAP = 12;
const BUCKETS = 240;

/** Last y range per plot, so each redraw can keep it while the data still fits. */
const ranges = new Map<string, PlotRange>();

interface Props {
  readonly param: Parameter;
  readonly theme: GaugeTheme;
  readonly windowMs: number;
  /** The right-hand edge of the plot (ms since epoch), from the history store. */
  readonly now: number;
  readonly onRemove: () => void;
}

/**
 * One parameter's history, drawn as an instrument in the active gauge style: the scale and
 * numbers in the gauge's marking colour, the trace in its needle colour, the red zone where
 * the gauge has one, and a pointer at the right edge showing the current reading.
 */
export function PlotCard({ param, theme, windowMs, now, onRemove }: Props) {
  const d = useDisplayParameter(param);
  const glowId = `plot-glow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!d) return null;

  const since = now - windowMs;
  const raw = history.since(param.id, since);
  const thin = decimate(raw.t, raw.v.map(d.convert), windowMs / BUCKETS);
  const values = thin.v;
  const dataMin = values.length ? Math.min(...values) : d.lo;
  const dataMax = values.length ? Math.max(...values) : d.hi;
  const minSpan = Math.max((d.hi - d.lo) * 0.04, 10 ** -d.decimals);
  const key = `${param.id}|${d.unit}`;
  const range = stableRange(dataMin, dataMax, minSpan, ranges.get(key) ?? null);
  ranges.set(key, range);
  const { lo, hi } = range;
  const ticks = rangeTicks(range);

  const plotW = AREA.right - AREA.left;
  const plotH = AREA.bottom - AREA.top;
  const traceLeft = AREA.left + TRACE_GAP;
  const traceW = AREA.right - traceLeft;
  const x = (t: number) => traceLeft + ((t - since) / windowMs) * traceW;
  const y = (v: number) => AREA.top + (1 - (v - lo) / (hi - lo)) * plotH;

  let line = '';
  thin.t.forEach((t, i) => {
    line += `${line ? 'L' : 'M'}${x(t).toFixed(1)},${y(values[i] ?? 0).toFixed(1)}`;
  });
  const firstT = thin.t[0];
  const lastT = thin.t.at(-1);
  const area =
    line && firstT !== undefined && lastT !== undefined
      ? `${line}L${x(lastT).toFixed(1)},${String(AREA.bottom)}L${x(firstT).toFixed(1)},${String(AREA.bottom)}Z`
      : '';
  const current = d.value;
  const warning = current !== null && inWarning(d, current);
  const redFrom = d.redline !== undefined && d.redline < hi ? Math.max(d.redline, lo) : null;
  const lowTo = d.warnLow !== undefined && d.warnLow > lo ? Math.min(d.warnLow, hi) : null;

  const look = LOOKS[theme.style];
  const glow = theme.glow ? `url(#${glowId})` : undefined;
  const textGlow = glow;
  const fmt = d.format;
  const minorTicks = ticks.slice(0, -1).map((v, i) => (v + (ticks[i + 1] ?? v)) / 2);

  return (
    <div className="plot-card">
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className="plot-svg"
        role="img"
        aria-label={`${d.name} over the last ${String(Math.round(windowMs / 1000))} seconds`}
      >
        <defs>
          <GlowFilter id={glowId} x={0} y={0} width={W} height={H} />
        </defs>

        {/* Bezel and face, for the styles whose gauges have one. */}
        {look.bezel ? (
          <rect
            x={look.bezel / 2 + 0.5}
            y={look.bezel / 2 + 0.5}
            width={W - look.bezel - 1}
            height={H - look.bezel - 1}
            rx={12}
            fill={theme.cap}
            stroke={warning && theme.style === 'performance' ? theme.red : theme.ring}
            strokeWidth={look.bezel}
            className={warning && theme.style === 'performance' ? 'warn-flash' : undefined}
            filter={glow}
          />
        ) : null}

        {/* Header: name, reading, unit. */}
        <text
          x={18}
          y={23}
          className="gauge-label"
          fontSize={12}
          letterSpacing={1.2}
          fill={look.labelColour(theme)}
          filter={textGlow}
        >
          {d.label}
        </text>
        {look.digital ? (
          <>
            <rect x={262} y={9} width={70} height={20} rx={3} fill="#000" stroke={theme.line} />
            <text
              x={326}
              y={24}
              textAnchor="end"
              className="gauge-value"
              fontSize={14}
              fill={warning ? theme.red : theme.mark}
              filter={textGlow}
            >
              {current === null ? '—' : fmt(current)}
            </text>
            <text
              x={337}
              y={24}
              className="gauge-label"
              fontSize={10}
              fill={theme.sub}
              filter={textGlow}
            >
              {d.unit}
            </text>
          </>
        ) : (
          <text
            x={340}
            y={24}
            textAnchor="end"
            className="gauge-value"
            fontSize={17}
            fill={warning ? theme.red : theme.mark}
            filter={textGlow}
          >
            {current === null ? '—' : fmt(current)}
            <tspan fontSize={11} fill={theme.sub} dx={4}>
              {d.unit}
            </tspan>
          </text>
        )}

        {/* Grid at the major ticks. */}
        {ticks.map((v) => (
          <line
            key={`g${String(v)}`}
            x1={AREA.left}
            x2={AREA.right}
            y1={y(v)}
            y2={y(v)}
            stroke={theme.line}
            strokeWidth={1}
          />
        ))}

        {/* Red zone, drawn the way this style's gauges draw theirs. */}
        {redFrom === null ? null : look.redZone === 'band' ? (
          <rect
            x={AREA.left}
            y={AREA.top}
            width={plotW}
            height={y(redFrom) - AREA.top}
            fill={theme.red}
            opacity={0.14}
          />
        ) : (
          <line
            x1={AREA.left - 1}
            x2={AREA.left - 1}
            y1={AREA.top}
            y2={y(redFrom)}
            stroke={theme.red}
            strokeWidth={5}
          />
        )}
        {lowTo === null ? null : look.redZone === 'band' ? (
          <rect
            x={AREA.left}
            y={y(lowTo)}
            width={plotW}
            height={AREA.bottom - y(lowTo)}
            fill={theme.red}
            opacity={0.14}
          />
        ) : (
          <line
            x1={AREA.left - 1}
            x2={AREA.left - 1}
            y1={y(lowTo)}
            y2={AREA.bottom}
            stroke={theme.red}
            strokeWidth={5}
          />
        )}

        {/* Scale: axis line, major and minor ticks, numbers. */}
        <g stroke={theme.mark} filter={glow}>
          {look.axis ? (
            <line
              x1={AREA.left}
              x2={AREA.left}
              y1={AREA.top - 2}
              y2={AREA.bottom + 2}
              strokeWidth={look.axis}
            />
          ) : null}
          {ticks.map((v) => (
            <line
              key={`t${String(v)}`}
              x1={AREA.left - 7}
              x2={AREA.left + (look.axis ? 0 : 7)}
              y1={y(v)}
              y2={y(v)}
              strokeWidth={2.2}
            />
          ))}
          {minorTicks.map((v) => (
            <line
              key={`m${String(v)}`}
              x1={AREA.left - 4}
              x2={AREA.left + (look.axis ? 0 : 3)}
              y1={y(v)}
              y2={y(v)}
              strokeWidth={1.2}
            />
          ))}
        </g>
        {ticks.map((v) => (
          <text
            key={`n${String(v)}`}
            x={AREA.left - 11}
            y={y(v) + 4}
            textAnchor="end"
            className="dial-number"
            fontSize={11}
            fill={theme.mark}
            filter={textGlow}
          >
            {compact(v)}
          </text>
        ))}

        {/* Time marks along the bottom. */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={`x${String(f)}`}
            x1={traceLeft + f * traceW}
            x2={traceLeft + f * traceW}
            y1={AREA.bottom}
            y2={AREA.bottom + (f === 0.5 || f % 1 === 0 ? 5 : 3)}
            stroke={theme.sub}
            strokeWidth={1.2}
            filter={glow}
          />
        ))}
        {[0, 0.5].map((f) => (
          <text
            key={`l${String(f)}`}
            x={traceLeft + f * traceW}
            y={H - 8}
            textAnchor={f === 0 ? 'start' : 'middle'}
            className="gauge-label"
            fontSize={10}
            fill={theme.sub}
            filter={textGlow}
          >
            −{formatSeconds(((1 - f) * windowMs) / 1000)}
          </text>
        ))}
        <text
          x={AREA.right}
          y={H - 8}
          textAnchor="end"
          className="gauge-label"
          fontSize={10}
          fill={theme.sub}
          filter={textGlow}
        >
          now
        </text>

        {/* The trace, in the needle colour. */}
        {area && look.fill ? (
          <path
            d={area}
            fill={look.fill === 'mark' ? theme.mark : theme.needle}
            opacity={0.13}
            filter={glow}
          />
        ) : null}
        {line ? (
          <path
            d={line}
            fill="none"
            stroke={theme.needle}
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            filter={theme.glow ? glow : undefined}
          />
        ) : null}

        {/* Pointer at the current reading. */}
        {current !== null && lastT !== undefined ? (
          <path
            d={`M${String(AREA.right + 1)},${y(clamp(current, lo, hi)).toFixed(1)}l9,-6v12z`}
            fill={warning ? theme.red : theme.needle}
            filter={glow}
          />
        ) : null}

        {values.length === 0 ? (
          <text
            x={AREA.left + plotW / 2}
            y={AREA.top + plotH / 2 + 4}
            textAnchor="middle"
            className="gauge-label"
            fontSize={12}
            fill={theme.sub}
            filter={textGlow}
          >
            {d.problem ?? 'Waiting for data…'}
          </text>
        ) : null}
      </svg>
      <button
        type="button"
        className="plot-remove"
        onClick={onRemove}
        aria-label={`Remove ${d.name} plot`}
        style={{ color: theme.sub }}
      >
        ×
      </button>
    </div>
  );
}

interface Look {
  /** Bezel stroke width; 0 for none (Ford modules have no ring). */
  readonly bezel: number;
  /** Axis line width; 0 for ticks only. */
  readonly axis: number;
  readonly redZone: 'band' | 'strip';
  /** Shade under the trace, and in which colour. */
  readonly fill: 'needle' | 'mark' | null;
  /** Value in a digital readout box. */
  readonly digital: boolean;
  readonly labelColour: (theme: GaugeTheme) => string;
}

const LOOKS: Record<GaugeTheme['style'], Look> = {
  // '95 Ford: glowing scale arc with ticks and a red end mark, no bezel, no fills.
  ford95: {
    bezel: 0,
    axis: 3,
    redZone: 'strip',
    fill: null,
    digital: false,
    labelColour: (t) => t.mark,
  },
  // Super Duty: white scale ring, white markings, cyan needle trace, orange-red band.
  superDuty: {
    bezel: 3,
    axis: 0,
    redZone: 'band',
    fill: 'needle',
    digital: false,
    labelColour: (t) => t.sub,
  },
  // Super Duty small gauges: white segmented arc, orange end block, cyan needle.
  superDutySmall: {
    bezel: 0,
    axis: 3,
    redZone: 'band',
    fill: 'needle',
    digital: false,
    labelColour: (t) => t.mark,
  },
  // Subaru cluster: thin silver ring, white ticks, red band.
  subaru: {
    bezel: 1.6,
    axis: 0,
    redZone: 'band',
    fill: 'needle',
    digital: false,
    labelColour: (t) => t.sub,
  },
  // Subaru console: red-lit ring, filled bar in the marking colour.
  subaruConsole: {
    bezel: 1.6,
    axis: 0,
    redZone: 'strip',
    fill: 'mark',
    digital: false,
    labelColour: (t) => t.mark,
  },
  // Cruze: thick chrome surround, white markings, red needle.
  cruze: {
    bezel: 4,
    axis: 0,
    redZone: 'band',
    fill: 'needle',
    digital: false,
    labelColour: (t) => t.sub,
  },
  // Performance: black bezel, lit markings, red pointer, digital readout.
  performance: {
    bezel: 6,
    axis: 0,
    redZone: 'strip',
    fill: 'needle',
    digital: true,
    labelColour: (t) => t.sub,
  },
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function compact(v: number): string {
  if (Math.abs(v) >= 10000) return `${String(Number((v / 1000).toFixed(1)))}k`;
  return String(Number(v.toFixed(3)));
}

function formatSeconds(s: number): string {
  if (s >= 60) return `${String(Number((s / 60).toFixed(1)))} min`;
  return `${String(Math.round(s))} s`;
}
