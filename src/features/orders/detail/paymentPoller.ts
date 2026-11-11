import { MAX_POLL_ATTEMPTS, POLL_DELAYS_MS, nextPollDelay } from './pollSchedule';

export type PollerState = 'idle' | 'waiting' | 'paused' | 'exhausted' | 'stopped';

export interface PollerSnapshot {
  state: PollerState;
  /** Automatic checks started since the schedule last restarted. */
  attempts: number;
  inFlight: boolean;
}

export type CheckOutcome<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'error'; error: unknown }
  /** Another request is already running; nothing was sent. */
  | { kind: 'busy' }
  /** The poller was stopped while the request ran, so its result was dropped. */
  | { kind: 'stale' }
  | { kind: 'inactive' };

export interface PollerOptions<T> {
  fetch: () => Promise<T>;
  /** Return false once the value is final; the poller then stops. */
  shouldContinue: (value: T) => boolean;
  onResult: (value: T) => void;
  onChange?: (snapshot: PollerSnapshot) => void;
  delays?: readonly number[];
  maxAttempts?: number;
}

export interface Poller<T> {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  /** Runs one request through the same single slot as automatic checks, then restarts the schedule. */
  manualCheck(fetcher: () => Promise<T>): Promise<CheckOutcome<T>>;
  snapshot(): PollerSnapshot;
}

/**
 * Schedules re-fetches with backoff. It never has two requests in flight, and a response that
 * arrives after stop() is dropped rather than applied, so a late reply cannot overwrite newer state.
 */
export function createPoller<T>(options: PollerOptions<T>): Poller<T> {
  const delays = options.delays ?? POLL_DELAYS_MS;
  const maxAttempts = options.maxAttempts ?? MAX_POLL_ATTEMPTS;

  let state: PollerState = 'idle';
  let attempts = 0;
  let inFlight = false;
  let paused = false;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function snapshot(): PollerSnapshot {
    return { state, attempts, inFlight };
  }

  function publish() {
    options.onChange?.(snapshot());
  }

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule() {
    clearTimer();
    if (state === 'stopped') return;
    if (paused) {
      state = 'paused';
      publish();
      return;
    }
    const delay = nextPollDelay(attempts, delays, maxAttempts);
    if (delay === null) {
      state = 'exhausted';
      publish();
      return;
    }
    state = 'waiting';
    publish();
    timer = setTimeout(tick, delay);
  }

  async function execute(fetcher: () => Promise<T>): Promise<CheckOutcome<T>> {
    if (inFlight) return { kind: 'busy' };
    const token = generation;
    inFlight = true;
    publish();
    try {
      const value = await fetcher();
      if (token !== generation) return { kind: 'stale' };
      options.onResult(value);
      return { kind: 'ok', value };
    } catch (error) {
      if (token !== generation) return { kind: 'stale' };
      return { kind: 'error', error };
    } finally {
      inFlight = false;
      publish();
    }
  }

  function stop() {
    generation += 1;
    clearTimer();
    state = 'stopped';
    publish();
  }

  async function tick() {
    timer = null;
    if (inFlight) {
      schedule();
      return;
    }
    attempts += 1;
    const outcome = await execute(options.fetch);
    if (outcome.kind === 'stale' || state === 'stopped') return;
    if (outcome.kind === 'ok' && !options.shouldContinue(outcome.value)) {
      stop();
      return;
    }
    schedule();
  }

  return {
    start() {
      if (state !== 'idle') return;
      attempts = 0;
      schedule();
    },
    stop,
    pause() {
      if (state === 'stopped') return;
      paused = true;
      clearTimer();
      if (state === 'waiting') {
        state = 'paused';
        publish();
      }
    },
    resume() {
      if (state === 'stopped') return;
      paused = false;
      // Coming back to the tab restarts the schedule so the first re-check is quick.
      if (state === 'paused' && !inFlight) {
        attempts = 0;
        schedule();
      }
    },
    restart() {
      if (state === 'stopped') return;
      attempts = 0;
      schedule();
    },
    async manualCheck(fetcher) {
      if (state === 'stopped') return { kind: 'inactive' };
      if (inFlight) return { kind: 'busy' };
      clearTimer();
      const outcome = await execute(fetcher);
      if (outcome.kind === 'stale' || state === 'stopped') return outcome;
      if (outcome.kind === 'ok' && !options.shouldContinue(outcome.value)) {
        stop();
        return outcome;
      }
      attempts = 0;
      schedule();
      return outcome;
    },
    snapshot,
  };
}
