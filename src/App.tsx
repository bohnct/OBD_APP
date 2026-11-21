import { useCallback, useEffect, useRef, useState } from 'react';
import { session } from './app/session';
import { startHistoryRecording } from './history/recorder';
import { startCalculations } from './trip/calculator';
import { getProfile } from './profiles/registry';
import { startFlagTimers } from './state/flagTimers';
import { useLive } from './state/live';
import { gaugeLayoutFor, useSettings } from './state/settings';
import { GaugeDefs } from './ui/gauges/GaugeDefs';
import { AllDataPage } from './ui/pages/AllDataPage';
import { GaugePage } from './ui/pages/GaugePage';
import { PlotsPage } from './ui/pages/PlotsPage';
import { SettingsPanel } from './ui/settings/SettingsPanel';
import { Pager } from './ui/shell/Pager';
import { PlotsSheet } from './ui/shell/PlotsSheet';
import { SettingsSheet } from './ui/shell/SettingsSheet';
import { useVerticalSwipe } from './ui/shell/useVerticalSwipe';
import { useTheme } from './ui/theme/useTheme';
import { Toast } from './ui/Toast';
import { VehicleSilent } from './ui/VehicleSilent';
import { useWakeLock } from './ui/useWakeLock';

export function App() {
  const theme = useTheme();
  const connected = useLive((s) => s.connection.status === 'connected');
  useWakeLock(connected);

  // Record every reading for the plots page.
  useEffect(() => startHistoryRecording(), []);

  // Fuel economy, trip meter and distance to empty, worked out from live readings.
  const calcProfileId = useSettings((s) => s.profileId);
  useEffect(() => startCalculations(getProfile(calcProfileId)), [calcProfileId]);
  // How long on/off values such as a DPF regeneration have been on.
  useEffect(() => startFlagTimers(getProfile(calcProfileId)), [calcProfileId]);

  // Tell the session which parameters are on screen, so it only reads those.
  const page = useRef(0);
  const onPageChange = useCallback((index: number) => {
    page.current = index;
    const settings = useSettings.getState();
    const profile = getProfile(settings.profileId);
    session.setActive(
      index === 0 ? gaugeLayoutFor(settings, profile.id) : profile.parameters.map((p) => p.id),
    );
  }, []);
  // Swipe down for settings, up for the plots, starting anywhere away from the screen edges
  // so the phone's own edge gestures still work.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plotsOpen, setPlotsOpen] = useState(false);
  const onPlotsOpen = useCallback(
    (open: boolean) => {
      setPlotsOpen(open);
      // While the plots are up, the plotted parameters (pinned below) are all that's needed.
      if (open) session.setActive([]);
      else onPageChange(page.current);
    },
    [onPageChange],
  );
  const shell = useRef<HTMLElement>(null);
  const onSwipeDown = useCallback(() => {
    if (plotsOpen) onPlotsOpen(false);
    else setSettingsOpen(true);
  }, [plotsOpen, onPlotsOpen]);
  const onSwipeUp = useCallback(() => {
    if (settingsOpen) setSettingsOpen(false);
    else onPlotsOpen(true);
  }, [settingsOpen, onPlotsOpen]);
  useVerticalSwipe(shell, { onSwipeDown, onSwipeUp });

  // The user's update-rate setting.
  const updateMs = useSettings((s) => s.updateMs);
  useEffect(() => {
    session.setUpdateInterval(updateMs);
  }, [updateMs]);

  // Plotted parameters keep being read on every page so their history has no gaps.
  const plotsKey = useSettings((s) => (s.plots[s.profileId] ?? []).join(','));
  useEffect(() => {
    session.setPinned(plotsKey ? plotsKey.split(',') : []);
  }, [plotsKey]);
  const layoutKey = useSettings((s) => gaugeLayoutFor(s, s.profileId).join(','));
  const profileId = useSettings((s) => s.profileId);
  useEffect(() => {
    onPageChange(page.current);
  }, [layoutKey, profileId, onPageChange]);

  // Development: open with ?sim to start the simulator right away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('sim')) {
      void session.connect('simulator', useSettings.getState().profileId);
    }
  }, []);

  return (
    <main
      ref={shell}
      className={`app style-${theme.style}${theme.glow ? ' glow' : ''}`}
      style={{ background: theme.background }}
    >
      <GaugeDefs />
      <Pager
        dotColor={theme.mark}
        onPageChange={onPageChange}
        pages={[
          { key: 'gauges', content: <GaugePage theme={theme} /> },
          { key: 'data', content: <AllDataPage theme={theme} /> },
        ]}
      />
      <PlotsSheet theme={theme} open={plotsOpen} onOpenChange={onPlotsOpen}>
        <PlotsPage theme={theme} />
      </PlotsSheet>
      <Toast theme={theme} />
      <VehicleSilent theme={theme} />
      <SettingsSheet theme={theme} open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SettingsPanel theme={theme} />
      </SettingsSheet>
    </main>
  );
}
