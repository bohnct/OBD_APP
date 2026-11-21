import { useEffect, useState, type ReactNode } from 'react';
import { formatDuration } from '../../state/flagTimers';
import type { GaugeTheme } from '../theme/themes';
import { DialScale } from './SuperDutyGauge';
import { SmallScale } from './SuperDutySmallGauge';
import { DIAL_CENTRE, SMALL_LAYOUT } from './superDutyLayout';
import { GAUGE_HEIGHT, GAUGE_WIDTH, type GaugeProps } from './types';

/** Styles whose gauges are round dials; their lamps borrow the dial's scale. */
const DIAL_STYLES = new Set(['superDuty', 'subaru', 'cruze']);

interface LampState {
  readonly theme: GaugeTheme;
  readonly label: string;
  readonly on: boolean;
  readonly noReading: boolean;
  /** Timer text: time on so far, or how long the last one ran. */
  readonly detail: string;
}

/**
 * An on/off value (such as a DPF regeneration), drawn without a needle as a face from the
 * active style: the style's own scale, dim while off and lit (and gently pulsing) in the
 * warning colour while on, with a timer showing how long it has been on or how long the last
 * one ran.
 */
export function StatusLamp(props: GaugeProps) {
  const { theme, label, value, timer } = props;
  const on = value !== null && value >= 0.5;
  const since = on ? (timer?.since ?? null) : null;
  const now = useNow(since !== null);

  let detail = '';
  if (since !== null) detail = formatDuration(now - since);
  else if (!on && timer?.lastMs != null) detail = `LAST ${formatDuration(timer.lastMs)}`;

  const state: LampState = { theme, label, on, noReading: value === null, detail };
  let face: ReactNode;
  if (theme.style === 'superDutySmall') face = <SmallFace {...state} />;
  else if (DIAL_STYLES.has(theme.style)) face = <DialFace {...state} />;
  else face = <PanelFace {...state} />;

  return (
    <svg
      viewBox={`0 0 ${String(GAUGE_WIDTH)} ${String(GAUGE_HEIGHT)}`}
      role="img"
      aria-label={`${label} ${value === null ? 'no reading' : on ? 'on' : 'off'} ${detail}`}
      className="gauge"
    >
      {face}
    </svg>
  );
}

/** The scale's colour and effects: dim while off, lit in the warning colour while on. */
function scaleLook({ theme, on }: LampState) {
  return {
    colour: on ? theme.red : theme.sub,
    opacity: on ? 1 : 0.45,
    filter: on && theme.glow ? 'url(#glow-mark)' : undefined,
    className: on ? 'lamp-on' : undefined,
  };
}

function textGlow(theme: GaugeTheme) {
  return theme.glow ? 'url(#glow-text)' : undefined;
}

/** Super Duty small gauge: the segmented arc with OFF and ON at its ends. */
function SmallFace(state: LampState) {
  const { theme, label, on, noReading, detail } = state;
  const look = scaleLook(state);
  const { cx, leftEndX, rightEndX, endBaseline, labelY, bottomY } = SMALL_LAYOUT;
  return (
    <>
      <g opacity={look.opacity} filter={look.filter} className={look.className}>
        <SmallScale colour={look.colour} />
      </g>
      <g className="dial-number" fontWeight={600} fontSize={15} filter={textGlow(theme)}>
        <text
          x={leftEndX}
          y={endBaseline}
          textAnchor="end"
          fill={theme.mark}
          opacity={!on && !noReading ? 1 : 0.35}
        >
          OFF
        </text>
        <text
          x={rightEndX}
          y={endBaseline}
          textAnchor="start"
          fill={on ? theme.red : theme.mark}
          opacity={on ? 1 : 0.35}
        >
          ON
        </text>
      </g>
      <text
        x={cx}
        y={labelY}
        textAnchor="middle"
        className="gauge-label"
        fontSize={10.5}
        fontWeight={700}
        letterSpacing={0.4}
        fill={on ? theme.red : theme.mark}
        filter={textGlow(theme)}
      >
        {label}
      </text>
      {detail ? (
        <text
          x={cx}
          y={bottomY + 22}
          textAnchor="middle"
          className="gauge-value"
          fontSize={on ? 16 : 12}
          fill={on ? theme.mark : theme.sub}
          filter={textGlow(theme)}
        >
          {detail}
        </text>
      ) : null}
    </>
  );
}

/** Round-dial styles: the dial's bare scale, with the state in the middle. */
function DialFace(state: LampState) {
  const { theme, label, on, noReading, detail } = state;
  const look = scaleLook(state);
  const { cx, cy } = DIAL_CENTRE;
  return (
    <>
      <circle cx={cx} cy={cy} r={82} fill={theme.cap} />
      <g opacity={look.opacity} filter={look.filter} className={look.className}>
        <DialScale colour={look.colour} />
      </g>
      <text
        x={cx}
        y={cy - 24}
        textAnchor="middle"
        className="gauge-label"
        fontSize={9.5}
        fontWeight={600}
        letterSpacing={0.5}
        fill={theme.sub}
        filter={textGlow(theme)}
      >
        {label}
      </text>
      <StateWord theme={theme} on={on} noReading={noReading} x={cx} y={cy + 12} size={30} />
      {detail ? (
        <text
          x={cx}
          y={cy + 62}
          textAnchor="middle"
          className="gauge-value"
          fontSize={on ? 18 : 12}
          fill={on ? theme.mark : theme.sub}
          filter={textGlow(theme)}
        >
          {detail}
        </text>
      ) : null}
    </>
  );
}

/** Other styles: a warning-lamp panel in the style's colours. */
function PanelFace(state: LampState) {
  const { theme, label, on, noReading, detail } = state;
  const look = scaleLook(state);
  const cx = GAUGE_WIDTH / 2;
  const cy = 86;
  const shape = <rect x={cx - 78} y={cy - 46} width={156} height={92} rx={14} />;
  return (
    <>
      <g fill={on ? theme.red : theme.cap} fillOpacity={on ? 0.16 : 1}>
        {shape}
      </g>
      <g
        fill="none"
        stroke={look.colour}
        strokeWidth={on ? 5 : 2.5}
        opacity={on ? 1 : 0.55}
        filter={look.filter}
        className={look.className}
      >
        {shape}
      </g>
      <text
        x={cx}
        y={cy - 22}
        textAnchor="middle"
        className="gauge-label"
        fontSize={11}
        fontWeight={600}
        letterSpacing={0.8}
        fill={on ? theme.mark : theme.sub}
        filter={textGlow(theme)}
      >
        {label}
      </text>
      <StateWord theme={theme} on={on} noReading={noReading} x={cx} y={cy + 14} size={34} />
      {detail ? (
        <text
          x={cx}
          y={cy + 36}
          textAnchor="middle"
          className="gauge-value"
          fontSize={detail.length > 8 ? 11 : 15}
          fill={on ? theme.mark : theme.sub}
          filter={textGlow(theme)}
        >
          {detail}
        </text>
      ) : null}
    </>
  );
}

function StateWord(props: {
  readonly theme: GaugeTheme;
  readonly on: boolean;
  readonly noReading: boolean;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}) {
  const { theme, on, noReading, x, y, size } = props;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      className="gauge-value"
      fontSize={size}
      fontWeight={700}
      fill={on ? theme.red : theme.sub}
      opacity={noReading ? 0.5 : 1}
      filter={textGlow(theme)}
    >
      {noReading ? '—' : on ? 'ON' : 'OFF'}
    </text>
  );
}

/** The current time, updated every second while `running`. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [running]);
  return now;
}
