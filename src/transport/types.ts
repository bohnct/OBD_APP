/** A byte pipe to an ELM327-compatible adapter (Bluetooth, or the simulator). */
export interface Transport {
  readonly name: string;
  /** Writes text to the adapter. */
  write(text: string): Promise<void>;
  /** Subscribes to text received from the adapter. Returns an unsubscribe function. */
  onReceive(listener: (text: string) => void): () => void;
  /** Subscribes to the connection dropping. Returns an unsubscribe function. */
  onDisconnect(listener: () => void): () => void;
  close(): Promise<void>;
}
