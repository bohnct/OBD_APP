import { useEffect, useState } from 'react';
import { gaugeStyleFor, useSettings } from '../../state/settings';
import { BACKLIGHT_COLORS, THEMES, type GaugeTheme } from './themes';

const DAY_STARTS = 7;
const NIGHT_STARTS = 19;

function isDaytime(date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= DAY_STARTS && hour < NIGHT_STARTS;
}

/** The active gauge theme: the vehicle's style, in day or night colours. */
export function useTheme(): GaugeTheme {
  const profileId = useSettings((s) => s.profileId);
  const mode = useSettings((s) => s.themeMode);
  const [day, setDay] = useState(isDaytime);

  useEffect(() => {
    if (mode !== 'auto') return;
    const timer = setInterval(() => {
      setDay(isDaytime());
    }, 60_000);
    return () => {
      clearInterval(timer);
    };
  }, [mode]);

  const style = useSettings((s) => gaugeStyleFor(s, profileId));
  const backlight = useSettings((s) => s.backlight);
  const useDay = mode === 'day' || (mode === 'auto' && day);
  const theme: GaugeTheme = THEMES[style][useDay ? 'day' : 'night'];
  if (style !== 'performance') return theme;
  // Performance gauges are lit in the colour picked in settings.
  const lit = BACKLIGHT_COLORS[backlight];
  return { ...theme, mark: lit, sub: `${lit}b3` };
}
