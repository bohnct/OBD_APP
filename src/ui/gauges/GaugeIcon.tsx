import type { ReactNode } from 'react';
import { SYMBOL_FOR, type GaugeSymbol } from './gaugeSymbols';

/**
 * Small line-drawn symbols for the common gauges, like those in the middle of the Super Duty
 * cluster's small gauges. Each is drawn in a 24 × 24 box centred on (0, 0).
 */
const ICONS: Readonly<Record<GaugeSymbol, ReactNode>> = {
  // Thermometer standing in water
  coolant: (
    <>
      <path d="M-1.5 -10 a1.5 1.5 0 0 1 3 0 V2 a3.6 3.6 0 1 1 -3 0 Z" />
      <path d="M1.5 -7 h3 M1.5 -3.5 h3" />
      <path d="M-11 6 q2.5 -2 5 0 t5 0 M1 6 q2.5 -2 5 0 t5 0" />
      <path d="M-11 10 q2.5 -2 5 0 t5 0 M1 10 q2.5 -2 5 0 t5 0" />
    </>
  ),
  // Oil can with a drop at the spout
  oil: (
    <>
      <path d="M-9 -1 h12 l4 -3 l5 -1.5 l-7 8 H-9 Z" />
      <path d="M-6 -1 v-3 h4 v3 M-10.5 -3 l3 2" />
      <path d="M11 3 q1 2 0 3 q-1 -1 0 -3" />
    </>
  ),
  // Fuel pump with hose
  fuel: (
    <>
      <path d="M-8 10 V-9 a1 1 0 0 1 1 -1 h8 a1 1 0 0 1 1 1 V10 Z M-10 10 h14" />
      <path d="M-6 -7 h6 v5 h-6 Z" />
      <path d="M2 -3 h3 v8 a1.5 1.5 0 0 0 3 0 V-4 l-3 -4" />
    </>
  ),
  // Turbocharger snail with an outlet
  turbo: (
    <>
      <circle r={6} />
      <path d="M0 -6 a6 6 0 0 1 0 0 M0 -2.5 a2.5 2.5 0 1 1 -2.5 2.5" />
      <path d="M5 -3.5 h6 v6 h-5" />
    </>
  ),
  // DEF: a drop of fluid
  def: (
    <>
      <path d="M0 -10 C4 -4 7 0 7 4 a7 7 0 0 1 -14 0 C-7 0 -4 -4 0 -10 Z" />
      <path d="M-3 4 a3 3 0 0 0 3 3" />
    </>
  ),
};

/** Draws the parameter's symbol centred at (x, y), or nothing if it has none. */
export function GaugeIcon(props: {
  readonly id: string | undefined;
  readonly x: number;
  readonly y: number;
  readonly colour: string;
  readonly scale?: number;
}) {
  const symbol = props.id === undefined ? undefined : SYMBOL_FOR[props.id];
  if (symbol === undefined) return null;
  return (
    <g
      transform={`translate(${String(props.x)} ${String(props.y)}) scale(${String(props.scale ?? 1)})`}
      fill="none"
      stroke={props.colour}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[symbol]}
    </g>
  );
}
