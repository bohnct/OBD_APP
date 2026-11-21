import { ConsoleGauge } from './ConsoleGauge';
import { FordGauge } from './FordGauge';
import { PerformanceGauge } from './PerformanceGauge';
import { RoundGauge } from './RoundGauge';
import { StatusLamp } from './StatusLamp';
import { SuperDutyGauge } from './SuperDutyGauge';
import { SuperDutySmallGauge } from './SuperDutySmallGauge';
import type { GaugeProps } from './types';

/** Draws a gauge in the active style. */
export function Gauge(props: GaugeProps) {
  // On/off values have nothing to sweep a needle over.
  if (props.binary) return <StatusLamp {...props} />;
  switch (props.theme.style) {
    case 'ford95':
      return <FordGauge {...props} />;
    case 'superDuty':
      return <SuperDutyGauge {...props} />;
    case 'superDutySmall':
      return <SuperDutySmallGauge {...props} />;
    case 'subaru':
    case 'cruze':
      return <RoundGauge {...props} />;
    case 'subaruConsole':
      return <ConsoleGauge {...props} />;
    case 'performance':
      return <PerformanceGauge {...props} />;
  }
}
