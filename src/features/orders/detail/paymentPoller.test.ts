import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, OrderStatus } from '../../../lib/api/types';
import { createPoller } from './paymentPoller';
import type { PollerSnapshot } from './paymentPoller';

function order(status: OrderStatus): Order {
  return {
    id: 'o1',
    number: 'ORD-100001',
    status,
    lines: [],
    total: { amount_minor: 1000, currency: 'USD' },
    invoice_id: null,
    failure_code: null,
    created_at: '2024-05-01T10:00:00Z',
    updated_at: '2024-05-01T10:00:00Z',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const stillPending = (o: Order) => o.status === 'payment_pending';

function setup(
  fetch: () => Promise<Order>,
  extra: { delays?: number[]; maxAttempts?: number; onChange?: (s: PollerSnapshot) => void } = {},
) {
  const onResult = vi.fn<(o: Order) => void>();
  const poller = createPoller<Order>({ fetch, shouldContinue: stillPending, onResult, ...extra });
  return { poller, onResult };
}

async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createPoller scheduling', () => {
  it('re-checks on the backoff schedule', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller, onResult } = setup(fetch);
    poller.start();

    await advance(2999);
    expect(fetch).toHaveBeenCalledTimes(0);
    await advance(1);
    expect(fetch).toHaveBeenCalledTimes(1);

    await advance(5999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetch).toHaveBeenCalledTimes(2);

    await advance(11999);
    expect(fetch).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(fetch).toHaveBeenCalledTimes(3);

    await advance(29999);
    expect(fetch).toHaveBeenCalledTimes(3);
    await advance(1);
    expect(fetch).toHaveBeenCalledTimes(4);

    expect(onResult).toHaveBeenCalledTimes(4);
    expect(poller.snapshot().state).toBe('waiting');
    poller.stop();
  });

  it('stops once the order is no longer payment_pending', async () => {
    const fetch = vi
      .fn<() => Promise<Order>>()
      .mockResolvedValueOnce(order('payment_pending'))
      .mockResolvedValueOnce(order('confirmed'));
    const { poller, onResult } = setup(fetch);
    poller.start();

    await advance(3000 + 6000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith(order('confirmed'));
    expect(poller.snapshot().state).toBe('stopped');

    await advance(200000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('repeats the last delay and stops after the attempt budget', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller } = setup(fetch, { delays: [10, 20], maxAttempts: 3 });
    poller.start();

    await advance(10);
    expect(fetch).toHaveBeenCalledTimes(1);
    await advance(20);
    expect(fetch).toHaveBeenCalledTimes(2);
    await advance(20);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(poller.snapshot()).toMatchObject({ state: 'exhausted', attempts: 3 });

    await advance(100000);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('only starts once', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller } = setup(fetch);
    poller.start();
    poller.start();
    await advance(3000);
    expect(fetch).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('restarts the schedule after it ran out', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller } = setup(fetch, { delays: [5], maxAttempts: 1 });
    poller.start();
    await advance(5);
    expect(poller.snapshot().state).toBe('exhausted');

    poller.restart();
    expect(poller.snapshot().state).toBe('waiting');
    await advance(5);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(poller.snapshot().state).toBe('exhausted');
  });

  it('keeps going after a failed check', async () => {
    const fetch = vi
      .fn<() => Promise<Order>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(order('payment_pending'));
    const { poller, onResult } = setup(fetch);
    poller.start();

    await advance(3000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
    expect(poller.snapshot().state).toBe('waiting');

    await advance(6000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('reports each step through onChange', async () => {
    const snapshots: PollerSnapshot[] = [];
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller } = setup(fetch, { onChange: (s) => snapshots.push(s) });
    poller.start();
    expect(snapshots[0]).toEqual({ state: 'waiting', attempts: 0, inFlight: false });

    await advance(3000);
    expect(snapshots.some((s) => s.inFlight && s.attempts === 1)).toBe(true);
    expect(snapshots[snapshots.length - 1]).toEqual({ state: 'waiting', attempts: 1, inFlight: false });
    poller.stop();
  });
});

describe('createPoller cancellation', () => {
  it('cancels the pending timer on stop', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller } = setup(fetch);
    poller.start();
    await advance(1000);
    poller.stop();

    await advance(200000);
    expect(fetch).not.toHaveBeenCalled();
    expect(poller.snapshot().state).toBe('stopped');
  });

  it('drops a response that arrives after stop', async () => {
    const pending = deferred<Order>();
    const fetch = vi.fn<() => Promise<Order>>().mockReturnValue(pending.promise);
    const { poller, onResult } = setup(fetch);
    poller.start();

    await advance(3000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(poller.snapshot().inFlight).toBe(true);

    poller.stop();
    pending.resolve(order('confirmed'));
    await advance(0);

    expect(onResult).not.toHaveBeenCalled();
    expect(poller.snapshot().inFlight).toBe(false);
    await advance(200000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('drops a failure that arrives after stop', async () => {
    const pending = deferred<Order>();
    const { poller, onResult } = setup(() => pending.promise);
    poller.start();
    await advance(3000);
    poller.stop();
    pending.reject(new Error('late'));
    await advance(0);
    expect(onResult).not.toHaveBeenCalled();
    expect(poller.snapshot().state).toBe('stopped');
  });

  it('ignores resume and restart once stopped', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller } = setup(fetch);
    poller.start();
    poller.stop();
    poller.resume();
    poller.restart();
    poller.pause();
    await advance(200000);
    expect(fetch).not.toHaveBeenCalled();
    expect(poller.snapshot().state).toBe('stopped');
  });
});

describe('createPoller pause and resume', () => {
  it('holds off while paused and starts again from the first delay', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller } = setup(fetch);
    poller.start();
    await advance(2000);

    poller.pause();
    expect(poller.snapshot().state).toBe('paused');
    await advance(200000);
    expect(fetch).not.toHaveBeenCalled();

    poller.resume();
    expect(poller.snapshot().state).toBe('waiting');
    await advance(2999);
    expect(fetch).not.toHaveBeenCalled();
    await advance(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('does not schedule anything when paused before start', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller } = setup(fetch);
    poller.pause();
    poller.start();
    expect(poller.snapshot().state).toBe('paused');
    await advance(100000);
    expect(fetch).not.toHaveBeenCalled();

    poller.resume();
    await advance(3000);
    expect(fetch).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('pauses after a request that was already running finishes', async () => {
    const pending = deferred<Order>();
    const fetch = vi.fn<() => Promise<Order>>().mockReturnValue(pending.promise);
    const { poller, onResult } = setup(fetch);
    poller.start();
    await advance(3000);

    poller.pause();
    pending.resolve(order('payment_pending'));
    await advance(0);

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(poller.snapshot().state).toBe('paused');
    await advance(200000);
    expect(fetch).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('leaves an exhausted poller exhausted when the tab comes back', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller } = setup(fetch, { delays: [5], maxAttempts: 1 });
    poller.start();
    await advance(5);
    poller.pause();
    poller.resume();
    expect(poller.snapshot().state).toBe('exhausted');
  });
});

describe('createPoller manual checks', () => {
  it('does not send a second request while one is running', async () => {
    const pending = deferred<Order>();
    const fetch = vi.fn<() => Promise<Order>>().mockReturnValue(pending.promise);
    const { poller } = setup(fetch);
    poller.start();
    await advance(3000);

    const manual = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    await expect(poller.manualCheck(manual)).resolves.toEqual({ kind: 'busy' });
    expect(manual).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);

    pending.resolve(order('payment_pending'));
    await advance(0);
    poller.stop();
  });

  it('holds back automatic checks while a manual one is running', async () => {
    const pending = deferred<Order>();
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller, onResult } = setup(fetch);
    poller.start();

    const manual = poller.manualCheck(() => pending.promise);
    await advance(100000);
    expect(fetch).not.toHaveBeenCalled();

    pending.resolve(order('payment_pending'));
    await expect(manual).resolves.toEqual({ kind: 'ok', value: order('payment_pending') });
    expect(onResult).toHaveBeenCalledTimes(1);

    await advance(2999);
    expect(fetch).not.toHaveBeenCalled();
    await advance(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('resets the schedule to the first delay', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller } = setup(fetch);
    poller.start();
    await advance(3000 + 6000);
    expect(fetch).toHaveBeenCalledTimes(2);

    await advance(5000);
    await poller.manualCheck(async () => order('payment_pending'));
    expect(poller.snapshot().attempts).toBe(0);

    await advance(2999);
    expect(fetch).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    poller.stop();
  });

  it('stops when the manual check finds a final status', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller, onResult } = setup(fetch);
    poller.start();

    const outcome = await poller.manualCheck(async () => order('confirmed'));
    expect(outcome).toEqual({ kind: 'ok', value: order('confirmed') });
    expect(onResult).toHaveBeenCalledWith(order('confirmed'));
    expect(poller.snapshot().state).toBe('stopped');

    await advance(200000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports a failed manual check and keeps polling', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller, onResult } = setup(fetch);
    poller.start();

    const failure = new Error('gateway down');
    const outcome = await poller.manualCheck(() => Promise.reject(failure));
    expect(outcome).toEqual({ kind: 'error', error: failure });
    expect(onResult).not.toHaveBeenCalled();
    expect(poller.snapshot().state).toBe('waiting');

    await advance(3000);
    expect(fetch).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('can restart a schedule that ran out', async () => {
    const fetch = vi.fn<() => Promise<Order>>().mockResolvedValue(order('payment_pending'));
    const { poller } = setup(fetch, { delays: [5], maxAttempts: 1 });
    poller.start();
    await advance(5);
    expect(poller.snapshot().state).toBe('exhausted');

    await poller.manualCheck(async () => order('payment_pending'));
    expect(poller.snapshot().state).toBe('waiting');
    await advance(5);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('drops the result of a manual check that was stopped mid-flight', async () => {
    const pending = deferred<Order>();
    const { poller, onResult } = setup(async () => order('payment_pending'));
    poller.start();

    const manual = poller.manualCheck(() => pending.promise);
    poller.stop();
    pending.resolve(order('confirmed'));

    await expect(manual).resolves.toEqual({ kind: 'stale' });
    expect(onResult).not.toHaveBeenCalled();
  });

  it('is inactive after stop', async () => {
    const { poller } = setup(async () => order('payment_pending'));
    poller.start();
    poller.stop();
    const manual = vi.fn<() => Promise<Order>>();
    await expect(poller.manualCheck(manual)).resolves.toEqual({ kind: 'inactive' });
    expect(manual).not.toHaveBeenCalled();
  });
});
