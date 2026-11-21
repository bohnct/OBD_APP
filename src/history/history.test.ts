import { describe, expect, it } from 'vitest';
import { history } from './history';

describe('history', () => {
  it('keeps readings in time order and returns a window', () => {
    history.clear();
    history.record({ boost: { value: 1, at: 1000 } });
    history.record({ boost: { value: 2, at: 2000 } });
    history.record({ boost: { value: 2, at: 2000 } }); // repeat ignored
    history.record({ boost: { value: 3, at: 3000 } });
    expect(history.since('boost', 2000)).toEqual({ t: [2000, 3000], v: [2, 3] });
    expect(history.since('boost', 0).t).toHaveLength(3);
    expect(history.since('missing', 0)).toEqual({ t: [], v: [] });
  });

  it('drops data older than it keeps', () => {
    history.clear();
    history.record({ rpm: { value: 700, at: 0 } });
    history.record({ rpm: { value: 800, at: 20 * 60 * 1000 } });
    expect(history.since('rpm', 0).v).toEqual([800]);
  });
});
