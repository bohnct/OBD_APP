import { useLive } from '../state/live';
import { history } from './history';

/** Records every new reading into the history buffer. Returns a stop function. */
export function startHistoryRecording(): () => void {
  return useLive.subscribe((state, previous) => {
    if (state.readings !== previous.readings) history.record(state.readings);
  });
}
