import { describe, expect, it, vi } from 'vitest';
import type { Transport } from '../transport/types';
import { AdapterTimeout, ElmClient } from './elmClient';

function fakeTransport(answer: (command: string) => string | null) {
  let listener: ((text: string) => void) | undefined;
  const transport: Transport = {
    name: 'fake',
    write: (text) => {
      const reply = answer(text.trim());
      if (reply !== null) {
        // Deliver in two pieces to prove buffering works.
        setTimeout(() => listener?.(reply.slice(0, 2)), 1);
        setTimeout(() => listener?.(`${reply.slice(2)}\r\r>`), 2);
      }
      return Promise.resolve();
    },
    onReceive: (l) => {
      listener = l;
      return () => (listener = undefined);
    },
    onDisconnect: () => () => undefined,
    close: () => Promise.resolve(),
  };
  return transport;
}

describe('ElmClient', () => {
  it('sends one command at a time and buffers until the prompt', async () => {
    const client = new ElmClient(fakeTransport((c) => (c === 'ATE0' ? 'OK' : '410C1AF8')));
    const [a, b] = await Promise.all([client.send('ATE0'), client.send('010C')]);
    expect(a.trim()).toBe('OK');
    expect(b.trim()).toBe('410C1AF8');
  });

  it('times out a command that never answers, then carries on', async () => {
    vi.useFakeTimers();
    const client = new ElmClient(
      fakeTransport((c) => (c === '0100' ? null : 'OK')),
      100,
    );
    const first = client.send('0100');
    const second = client.send('ATI');
    const assertion = expect(first).rejects.toBeInstanceOf(AdapterTimeout);
    await vi.advanceTimersByTimeAsync(150);
    await assertion;
    await expect(second).resolves.toContain('OK');
    vi.useRealTimers();
  });
});
