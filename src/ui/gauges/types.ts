import type { FlagTimer } from '../../state/flagTimers';
import type { GaugeTheme } from '../theme/themes';

export interface GaugeProps {
  readonly theme: GaugeTheme;
  /** Parameter id, used by styles that show a symbol instead of a name. */
  readonly id?: string | undefined;
  readonly label: string;
  readonly unit: string;
  /** Scale ends, in display units. */
  readonly lo: number;
  readonly hi: number;
  /** Current value in display units, or null when there's no reading. */
  readonly value: number | null;
  readonly decimals: number;
  /** Value as text (e.g. ON/OFF for flags); defaults to the number at `decimals`. */
  readonly format?: ((value: number) => string) | undefined;
  readonly redline?: number | undefined;
  /** Low warning zone: at or below this is red. */
  readonly warnLow?: number | undefined;
  readonly normal?: readonly [number, number] | undefined;
  /** On/off values are drawn as a lamp with a timer instead of a dial. */
  readonly binary?: boolean | undefined;
  readonly timer?: FlagTimer | undefined;
  /** '95 Ford gauges: top row pivots from above, bottom row from below. */
  readonly variant: 'top' | 'bottom';
}

export const GAUGE_WIDTH = 196;
export const GAUGE_HEIGHT = 176;
