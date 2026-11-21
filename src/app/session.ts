import { trafficLog } from '../diagnostics/trafficLog';
import {
  openBluetoothLink,
  pickAdapter,
  openSimulatorLink,
  type LinkObserver,
  type VehicleLink,
} from '../link/vehicleLink';
import { Poller, type PollerSink } from '../polling/poller';
import { getProfile } from '../profiles/registry';
import type { Profile } from '../profiles/schema';
import { useLive } from '../state/live';
import { useSettings } from '../state/settings';

export type AdapterKind = 'bluetooth' | 'simulator';

/** Read about once a second in the background so trip distance and fuel used keep counting. */
const TRIP_INPUTS = ['speed', 'fuelRate', 'maf'];

/** If the adapter drops out, how long to keep trying to get it back, and how often. */
const RECONNECT_FOR_MS = 90_000;
const RECONNECT_EVERY_MS = 2000;

/**
 * Owns the one live connection: opening it, polling, and tearing it down.
 * Screens tell it which parameters they show; it never sends anything itself.
 *
 * Built for start-ups: connect with the key on, and it keeps reading through the crank.
 * If the vehicle goes quiet it keeps asking; if the adapter drops out (voltage dip) it
 * reconnects to the same adapter without the picker. Readings and history are kept.
 */
class Session {
  private link: VehicleLink | null = null;
  private poller: Poller | null = null;
  private active: readonly string[] = [];
  private pinned: readonly string[] = [];
  private lastKind: AdapterKind | null = null;
  private attempt = 0;
  private passMs = 0;

  get kind(): AdapterKind | null {
    return this.lastKind;
  }

  /** The user's update-rate setting: shortest time between screen updates, 0 for fastest. */
  setUpdateInterval(ms: number): void {
    this.passMs = ms;
    this.poller?.setPassInterval(ms);
  }

  async connect(kind: AdapterKind, profileId: string): Promise<void> {
    // A newer connect or disconnect makes this attempt stale; it then cleans up after itself.
    const attempt = ++this.attempt;
    // The Bluetooth picker has to open straight from the tap, before anything is awaited.
    const picking = kind === 'bluetooth' ? pickAdapter() : null;
    // If cleanup below fails first, the picker's outcome no longer matters.
    picking?.catch(() => undefined);
    await this.teardown();
    const live = useLive.getState();
    live.clear();
    live.setConnection({ status: 'connecting' });
    const profile = getProfile(profileId);
    const observer: LinkObserver = {
      onBlocked: (command) => {
        useLive.getState().addBlocked(command);
      },
      onTraffic: (entry) => {
        trafficLog.add(entry);
      },
    };
    let link: VehicleLink | null = null;
    try {
      link = picking
        ? await openBluetoothLink(await picking, profile, observer)
        : await openSimulatorLink(profile, observer);
      this.lastKind = kind;
      await this.begin(link, profile, attempt);
    } catch (error) {
      await link?.close().catch(() => undefined);
      if (attempt === this.attempt) {
        live.setConnection({ status: 'error', message: describeError(error) });
      }
    }
  }

  async disconnect(reason?: string): Promise<void> {
    this.attempt++;
    await this.teardown();
    const live = useLive.getState();
    live.clear();
    live.setConnection(reason ? { status: 'error', message: reason } : { status: 'disconnected' });
  }

  /** The parameters currently on screen, most important first. */
  setActive(ids: readonly string[]): void {
    this.active = ids;
    this.poller?.setActive(this.wanted());
  }

  /** Parameters read whatever page is showing (the plotted ones, so their history keeps up). */
  setPinned(ids: readonly string[]): void {
    this.pinned = ids;
    this.poller?.setActive(this.wanted());
  }

  /** Starts reading over an open link. Used for a first connect and for a reconnect. */
  private async begin(link: VehicleLink, profile: Profile, attempt: number): Promise<void> {
    // Ask which standard PIDs exist. No answer usually means the key is off; the poller
    // then keeps asking and starts reading as soon as the vehicle answers.
    const supported = await link.supportedPids();
    if (attempt !== this.attempt) {
      await link.close();
      return;
    }
    const live = useLive.getState();
    const responding = supported.size > 0;
    live.setSupportedPids(responding ? [...supported].sort((x, y) => x - y) : null);
    live.setVehicle(responding ? 'responding' : 'silent');

    const sink: PollerSink = {
      setReadings: live.setReadings,
      setProblem: live.setProblem,
      onSilent: () => {
        useLive.getState().setVehicle('silent');
      },
      onAwake: () => {
        useLive.getState().setVehicle('responding');
      },
      onZero: (sensorId, value) => {
        useSettings.getState().setZero(profile.id, sensorId, value);
      },
    };
    this.link = link;
    this.poller = new Poller(
      link,
      profile,
      sink,
      responding ? supported : null,
      useSettings.getState().zeros[profile.id],
    );
    this.poller.setVehicleSilent(!responding);
    this.poller.setPassInterval(this.passMs);
    this.poller.setActive(this.wanted());
    // Keep the trip meter's inputs coming whatever is on screen.
    const ids = new Set(profile.parameters.map((p) => p.id));
    this.poller.setBackground(TRIP_INPUTS.filter((id) => ids.has(id)));
    this.poller.start();
    link.onDisconnect(() => {
      if (this.link === link) void this.recover(link, profile, attempt);
    });
    live.setConnection({ status: 'connected', adapterName: link.adapterName });
  }

  /** The adapter dropped out unexpectedly: keep the data, and try to get the adapter back. */
  private async recover(lost: VehicleLink, profile: Profile, attempt: number): Promise<void> {
    this.poller?.stop();
    this.poller = null;
    this.link = null;
    const live = useLive.getState();
    live.setConnection({ status: 'reconnecting', adapterName: lost.adapterName });
    const giveUpAt = Date.now() + RECONNECT_FOR_MS;
    while (attempt === this.attempt && Date.now() < giveUpAt) {
      try {
        const link = await lost.reopen();
        if (attempt !== this.attempt) {
          await link.close();
          return;
        }
        await this.begin(link, profile, attempt);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, RECONNECT_EVERY_MS));
      }
    }
    if (attempt === this.attempt) await this.disconnect('Adapter disconnected.');
  }

  private async teardown(): Promise<void> {
    this.poller?.stop();
    this.poller = null;
    const link = this.link;
    this.link = null;
    await link?.close().catch(() => undefined);
  }

  private wanted(): readonly string[] {
    return [...this.active, ...this.pinned.filter((id) => !this.active.includes(id))];
  }
}

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotFoundError')
    return 'No adapter was picked.';
  if (error instanceof Error) return error.message || error.name;
  // Some iPhone Bluetooth browsers reject with a bare code instead of an error.
  return `Bluetooth failed (code ${String(error)}). Check Bluetooth is on and this browser is allowed to use it in the iPhone's Settings.`;
}

export const session = new Session();
