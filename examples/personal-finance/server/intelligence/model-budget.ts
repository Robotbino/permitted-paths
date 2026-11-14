// The budget of model calls for one day. It is the cost control of the application.
//
// A call is reserved BEFORE it is made, in one synchronous step. This matters: the first version
// of the application counted the calls in the trace, and a run writes its trace only after the model
// answers. Ten requests that arrived together all read "0 calls" and all called the model.
// It also counted nothing when the trace failed to save. A reservation has neither problem.
//
// The trace is still used one time each day, to start the count after the server starts again.
import type { Clock } from '../clock.ts';

export type ModelBudget = {
  readonly cap: number;
  /** Asks for n calls. Returns how many are granted (0 to n) and counts them as used immediately. */
  reserve(n: number): number;
  usedToday(): number;
};

export function modelBudget(cap: number, clock: Clock, countSaved?: (utcDay: string) => number): ModelBudget {
  const limit = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 0; // a setting that is not a number gives no calls
  let day = '';
  let used = 0;
  function roll(): void {
    const today = clock.today();
    if (today === day) return;
    day = today;
    try {
      used = countSaved ? countSaved(clock.now().slice(0, 10)) : 0;
    } catch {
      used = limit; // the count cannot be read: no calls today
    }
  }
  return {
    cap: limit,
    reserve(n) {
      roll();
      const granted = Math.max(0, Math.min(Math.floor(n), limit - used));
      used += granted;
      return granted;
    },
    usedToday() {
      roll();
      return used;
    },
  };
}
