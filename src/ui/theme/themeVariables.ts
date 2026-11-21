import type { CSSProperties } from 'react';
import type { GaugeTheme } from './themes';

/** The theme's colours as CSS variables, for the settings sheet and dialogs. */
export function themeVariables(theme: GaugeTheme): CSSProperties {
  return {
    ['--accent' as string]: theme.mark,
    ['--muted' as string]: theme.sub,
    ['--line' as string]: theme.line,
    ['--panel' as string]: theme.panel,
    ['--background' as string]: theme.background,
  };
}
