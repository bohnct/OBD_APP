import type { Transport } from './types';

/**
 * Serial-over-BLE layouts used by ELM327-compatible adapters.
 * Each adapter exposes one of these as a service with a notify and a write characteristic.
 */
const UART_PROFILES = [
  { service: uuid16(0xfff0), notify: uuid16(0xfff1), write: uuid16(0xfff2) }, // most ELM327 clones
  { service: uuid16(0xffe0), notify: uuid16(0xffe1), write: uuid16(0xffe1) }, // HM-10 style modules
  { service: uuid16(0x18f0), notify: uuid16(0x2af0), write: uuid16(0x2af1) }, // vLinker, OBDLink
  {
    service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
    notify: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
    write: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  },
] as const;

/**
 * A 16-bit Bluetooth UUID in its full 128-bit form. Chrome accepts the short numbers too, but
 * iPhone Web Bluetooth browsers such as Bluefy only accept full UUID strings.
 */
function uuid16(short: number): string {
  return `0000${short.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;
}

/** BLE writes are limited in size; 20 bytes always works. */
const CHUNK_SIZE = 20;

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Shows the browser's device picker. Must be called straight from a tap or click, before
 * anything is awaited: iPhone browsers refuse it otherwise.
 */
export function pickAdapter(): Promise<BluetoothDevice> {
  return navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: UART_PROFILES.map((p) => p.service),
  });
}

/** Opens a transport to an adapter the user has already picked. */
export async function connectAdapter(device: BluetoothDevice): Promise<Transport> {
  const gatt = device.gatt;
  if (!gatt) throw new Error('This Bluetooth device has no GATT server.');
  const server = await gatt.connect();

  for (const profile of UART_PROFILES) {
    let service: BluetoothRemoteGATTService;
    try {
      service = await server.getPrimaryService(profile.service);
    } catch {
      continue; // not this layout
    }
    const notify = await service.getCharacteristic(profile.notify);
    const write = await service.getCharacteristic(profile.write);
    await notify.startNotifications();
    return new WebBluetoothTransport(device, notify, write);
  }
  gatt.disconnect();
  throw new Error('This device is not a supported OBD adapter (no serial service found).');
}

class WebBluetoothTransport implements Transport {
  readonly name: string;
  private readonly decoder = new TextDecoder();
  private readonly encoder = new TextEncoder();
  private readonly receiveListeners = new Set<(text: string) => void>();
  private readonly disconnectListeners = new Set<() => void>();

  constructor(
    private readonly device: BluetoothDevice,
    notify: BluetoothRemoteGATTCharacteristic,
    private readonly writer: BluetoothRemoteGATTCharacteristic,
  ) {
    this.name = device.name ?? 'Bluetooth adapter';
    notify.addEventListener('characteristicvaluechanged', () => {
      const value = notify.value;
      if (!value) return;
      const text = this.decoder.decode(value);
      for (const listener of this.receiveListeners) listener(text);
    });
    device.addEventListener('gattserverdisconnected', () => {
      for (const listener of this.disconnectListeners) listener();
    });
  }

  async write(text: string): Promise<void> {
    const bytes = this.encoder.encode(text);
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      if (this.writer.properties.writeWithoutResponse) {
        await this.writer.writeValueWithoutResponse(chunk);
      } else {
        await this.writer.writeValueWithResponse(chunk);
      }
    }
  }

  onReceive(listener: (text: string) => void): () => void {
    this.receiveListeners.add(listener);
    return () => this.receiveListeners.delete(listener);
  }

  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  close(): Promise<void> {
    this.device.gatt?.disconnect();
    return Promise.resolve();
  }
}
