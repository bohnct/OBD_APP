import { polar } from './geometry';
import { GAUGE_WIDTH } from './types';

/*
 * Shared layout for the Super Duty styles, so the regen lamp can be drawn on the same
 * scales as the gauges.
 */

/** Centre of the main dial in its slot. */
export const DIAL_CENTRE = { cx: GAUGE_WIDTH / 2, cy: 88 } as const;

/** Small gauges (see SuperDutySmallGauge for how they were traced). */
const SMALL_R = 84;
const SMALL_CY = 22;
export const SMALL_GEOMETRY = {
  CX: GAUGE_WIDTH / 2,
  /** Pivot height: places the gauge in the middle of its slot, as it has no live reading. */
  CY: SMALL_CY,
  R: SMALL_R,
  DOWN: 270,
  /** The scale runs this far either side of straight down (degrees). */
  HALF: 44,
  BAND: 5,
  SEGMENTS: 4,
  /** Gap between arc segments (degrees). */
  GAP: 2.2,
  END_TICK: 13,
  MID_TICK: 7,
  /** The red warning tick sits this far past the end of the scale (degrees). */
  WARN_OFFSET: 8,
  NEEDLE_IN: SMALL_R - 30,
  NEEDLE_OUT: SMALL_R + 9,
} as const;

const { CX, CY, R, DOWN, HALF, BAND } = SMALL_GEOMETRY;
const [END_X] = polar(CX, CY, R, DOWN - HALF);

/** Where the parts of a small gauge sit, for other faces drawn in the same style. */
export const SMALL_LAYOUT = {
  cx: CX,
  /** Right edge of the low-end label and left edge of the high-end label. */
  leftEndX: END_X - 6,
  rightEndX: 2 * CX - END_X + 6,
  endBaseline: CY + R - 3,
  /** Baseline of the name inside the arc. */
  labelY: CY + R - 16,
  /** Lowest point of the arc. */
  bottomY: CY + R + BAND / 2,
} as const;
