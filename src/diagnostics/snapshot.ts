import { getProfile } from '../profiles/registry';
import { useLive } from '../state/live';
import { useSettings } from '../state/settings';
import { trafficLog } from './trafficLog';

/**
 * Everything needed to check the app against a real vehicle: what it sent, what came
 * back, and what it made of it. Contains no personal data; the VIN is never requested.
 */
export function buildSnapshot() {
  const settings = useSettings.getState();
  const live = useLive.getState();
  const profile = getProfile(settings.profileId);
  return {
    kind: 'obd-gauges-snapshot',
    version: 1,
    takenAt: new Date().toISOString(),
    appBuiltAt: __BUILD_TIME__,
    browser: navigator.userAgent,
    profile: { id: profile.id, name: profile.name, protocol: profile.connection.protocol },
    connection: live.connection,
    vehicle: live.vehicle,
    supportedPids:
      live.supportedPids?.map((pid) => pid.toString(16).toUpperCase().padStart(2, '0')) ?? null,
    readings: Object.fromEntries(
      profile.parameters.map((p) => [
        p.id,
        {
          value: live.readings[p.id]?.value ?? null,
          unit: p.unit,
          problem: live.problems[p.id] ?? null,
          request: p.request,
          verified: p.verified,
        },
      ]),
    ),
    blocked: live.blocked,
    traffic: trafficLog.all(),
  };
}

/** Saves a snapshot as a .json file through the browser's normal download. */
export function downloadSnapshot(): string {
  const snapshot = buildSnapshot();
  const stamp = snapshot.takenAt.replace(/[:.]/g, '-').slice(0, 19);
  const name = `obd-snapshot-${snapshot.profile.id}-${stamp}.json`;
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
  return name;
}
