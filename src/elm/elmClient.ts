import type { RawLine } from '../safety/commandGate';
import type { Transport } from '../transport/types';

const PROMPT = '>';

export class AdapterTimeout extends Error {
  constructor(readonly command: string) {
    super(`Adapter did not answer "${command}" in time.`);
    this.name = 'AdapterTimeout';
  }
}

interface Pending {
  readonly command: string;
  readonly resolve: (reply: string) => void;
  readonly reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Speaks the ELM327 line protocol: one command at a time, each reply ending in ">".
 *
 * This class is only ever handed to the CommandGate, which is the sole caller of send().
 */
export class ElmClient implements RawLine {
  private buffer = '';
  private readonly queue: Pending[] = [];
  private active: Pending | undefined;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly transport: Transport,
    private readonly timeoutMs = 2000,
  ) {
    this.unsubscribe = transport.onReceive((text) => {
      this.receive(text);
    });
  }

  send(command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.queue.push({ command, resolve, reject, timer: undefined });
      this.pump();
    });
  }

  dispose(): void {
    this.unsubscribe();
    const error = new Error('Adapter connection closed.');
    if (this.active) this.finish(undefined, error);
    for (const pending of this.queue.splice(0)) pending.reject(error);
  }

  private pump(): void {
    if (this.active) return;
    const next = this.queue.shift();
    if (!next) return;
    this.active = next;
    this.buffer = '';
    // ATZ resets the adapter and takes noticeably longer to answer.
    const timeout = next.command === 'ATZ' ? this.timeoutMs * 2 : this.timeoutMs;
    next.timer = setTimeout(() => {
      this.finish(undefined, new AdapterTimeout(next.command));
    }, timeout);
    this.transport.write(`${next.command}\r`).catch((error: unknown) => {
      this.finish(undefined, error instanceof Error ? error : new Error(String(error)));
    });
  }

  private receive(text: string): void {
    if (!this.active) return; // stray bytes between commands
    this.buffer += text;
    const end = this.buffer.indexOf(PROMPT);
    if (end === -1) return;
    const reply = this.buffer.slice(0, end);
    this.buffer = '';
    this.finish(reply);
  }

  private finish(reply: string | undefined, error?: Error): void {
    const pending = this.active;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.active = undefined;
    if (error) pending.reject(error);
    else pending.resolve(reply ?? '');
    this.pump();
  }
}
