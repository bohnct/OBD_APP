import type { ReactNode } from 'react';
import { SYMBOL_FOR, type GaugeSymbol } from './gaugeSymbols';

/**
 * Small line-drawn symbols for the common gauges, like those in the middle of the Super Duty
 * cluster's small gauges. All share one outline style (1.8 wide, rounded) and fit a box
 * about 22 wide and 19 tall centred on (0, 0), so they sit the same way in every gauge.
 */
const ICONS: Readonly<Record<GaugeSymbol, ReactNode>> = {
  // Thermometer standing in water
  coolant: (
    <>
      <path d="M-1.7 1.4 V-8.3 a1.7 1.7 0 0 1 3.4 0 V1.4 a3.4 3.4 0 1 1 -3.4 0 Z" />
      <path d="M1.7 -6 H4.5 M1.7 -2.5 H4.5" />
      <path d="M-11 4 q1.6 -1.6 3.2 0 t3.2 0 M5 4 q1.6 -1.6 3.2 0 t3.2 0" />
      <path d="M-11 8.5 q1.6 -1.6 3.2 0 t3.2 0 q1.6 -1.6 3.2 0 t3.2 0 q1.6 -1.6 3.2 0 t3.2 0 q1.6 -1.6 3.2 0" />
    </>
  ),
  // Oil can with a drop falling from the spout
  oil: (
    <>
      <path d="M-8 -1 H1 L10 -5 L4 6 H-8 Z" />
      <path d="M-5 -1 V-4 M-6.5 -4 H-1.5 M-3 -4 V-1" />
      <path d="M-8 1 L-11 -1.5" />
      <path d="M10 1.5 q1.6 2.4 0 3.6 q-1.6 -1.2 0 -3.6 Z" />
    </>
  ),
  // Fuel pump with its hose
  fuel: (
    <>
      <path d="M-7.5 9 V-7.5 a1.5 1.5 0 0 1 1.5 -1.5 H1 a1.5 1.5 0 0 1 1.5 1.5 V9" />
      <path d="M-10 9 H5" />
      <path d="M-5 -6.5 H0 V-2 H-5 Z" />
      <path d="M2.5 -1 H5 V5 a1.6 1.6 0 0 0 3.2 0 V-4.5 L5.5 -7.5" />
    </>
  ),
  // Turbocharger: snail housing with its outlet
  turbo: (
    <>
      <path d="M2.5 -5.2 A6.5 6.5 0 1 0 6.5 1" />
      <path d="M2.5 -5.2 H10 V1 H6.5" />
      <circle cx={0} cy={1} r={2.4} />
    </>
  ),
  // DEF: a drop of fluid
  def: (
    <>
      <path d="M0 -9.5 C4 -4.5 7 -1 7 2.8 a7 7 0 0 1 -14 0 C-7 -1 -4 -4.5 0 -9.5 Z" />
      <path d="M-3.5 3 a3.5 3.5 0 0 0 3.5 3.5" />
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
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[symbol]}
    </g>
  );
}
