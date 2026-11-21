/**
 * The night glow, in one place, so every gauge, plot, number and needle glows the same.
 * A soft copy of the shape is blurred and laid under the sharp original.
 */
export const GLOW_BLUR = 2;
/** Strength of the blurred halo (0–1). */
export const GLOW_STRENGTH = 0.9;

interface Props {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The filter region is given in drawing coordinates (userSpaceOnUse), not the element's
 * bounding box: a bounding-box region collapses on a straight horizontal or vertical line,
 * which made marks look thinner or thicker depending on their angle.
 */
export function GlowFilter({ id, x, y, width, height }: Props) {
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x={x} y={y} width={width} height={height}>
      <feGaussianBlur in="SourceGraphic" stdDeviation={GLOW_BLUR} result="blur" />
      <feComponentTransfer in="blur" result="halo">
        <feFuncA type="linear" slope={GLOW_STRENGTH * 1.6} />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="halo" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}
