/** The symbols drawn by GaugeIcon. */
export type GaugeSymbol = 'coolant' | 'oil' | 'fuel' | 'turbo' | 'def';

/** Which symbol each parameter uses. */
export const SYMBOL_FOR: Readonly<Partial<Record<string, GaugeSymbol>>> = {
  coolant: 'coolant',
  oilTemp: 'oil',
  eot: 'oil',
  oilPressure: 'oil',
  fuelLevel: 'fuel',
  boost: 'turbo',
  boostMap: 'turbo',
  defLevel: 'def',
};

/** Whether a parameter has a symbol. */
export function hasIcon(id: string | undefined): boolean {
  return id !== undefined && SYMBOL_FOR[id] !== undefined;
}
