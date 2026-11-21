import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../theme/themes';
import { PerformanceGauge } from './PerformanceGauge';

const base = {
  theme: THEMES.performance.night,
  label: 'COOLANT',
  unit: '°F',
  lo: 100,
  hi: 260,
  decimals: 0,
  redline: 240,
  normal: undefined,
  variant: 'top',
} as const;

describe('PerformanceGauge', () => {
  it('lights the whole dial when past the warning point', () => {
    expect(renderToStaticMarkup(<PerformanceGauge {...base} value={250} />)).toContain(
      'warn-flash',
    );
  });

  it('stays dark below the warning point and with no reading', () => {
    expect(renderToStaticMarkup(<PerformanceGauge {...base} value={200} />)).not.toContain(
      'warn-flash',
    );
    expect(renderToStaticMarkup(<PerformanceGauge {...base} value={null} />)).not.toContain(
      'warn-flash',
    );
  });
});
