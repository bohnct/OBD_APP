import { GlowFilter } from './GlowFilter';

/** Gauge coordinates, with room around the 196×176 dial for the glow to spread. */
const REGION = { x: -60, y: -60, width: 320, height: 300 } as const;

/**
 * Shared SVG filters for the night glow. Rendered once; gauges refer to them by id.
 * The three ids are the same glow; they're kept separate so a part can be tuned later
 * without touching every gauge.
 */
export function GaugeDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <GlowFilter id="glow-mark" {...REGION} />
        <GlowFilter id="glow-text" {...REGION} />
        <GlowFilter id="glow-needle" {...REGION} />
        {/* Warm light spilling from the incandescent bulb behind a Ford needle's pivot. */}
        <radialGradient id="bulb-glow">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.3" />
          <stop offset="0.45" stopColor="#ffb347" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ff9d2e" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
