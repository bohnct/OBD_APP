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
export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/**
 * Saves a snapshot file. On phones it opens the share sheet (Save to Files, Drive, email,
 * Messages…), because a plain download often does nothing in an installed app or in iPhone
 * Bluetooth browsers. Elsewhere, or if sharing isn't available, it downloads the file.
 */
export async function saveSnapshot(): Promise<{ name: string; outcome: SaveOutcome }> {
  const snapshot = buildSnapshot();
  const stamp = snapshot.takenAt.replace(/[:.]/g, '-').slice(0, 19);
  const name = `obd-snapshot-${snapshot.profile.id}-${stamp}.json`;
  const text = JSON.stringify(snapshot, null, 2);

  const file = new File([text], name, { type: 'application/json' });
  if (prefersShare() && canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: name });
      return { name, outcome: 'shared' };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { name, outcome: 'cancelled' };
      }
      // Sharing refused (e.g. not from a tap): fall back to a download.
    }
  }
  return { name, outcome: download(text, name) ? 'downloaded' : 'failed' };
}

/** Touch devices share; computers download straight to the Downloads folder. */
function prefersShare(): boolean {
  return 'share' in navigator && matchMedia('(pointer: coarse)').matches;
}

/** Older browsers have share() but can't share files, or have no canShare at all. */
function canShareFile(file: File): boolean {
  return 'canShare' in navigator && navigator.canShare({ files: [file] });
}

function download(text: string, name: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.rel = 'noopener';
    // Some browsers only follow a link that is in the page.
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give slow devices time to read the file before it's released.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);
    return true;
  } catch {
    return false;
  }
}
