import { describe, expect, it } from 'vitest';
import type { OrderStatus } from '../../../lib/api/types';
import {
  MAX_POLL_ATTEMPTS,
  POLL_DELAYS_MS,
  nextPollDelay,
  shouldPoll,
  totalPollWindowMs,
} from './pollSchedule';

describe('nextPollDelay', () => {
  it('follows the backoff schedule and then repeats the last delay', () => {
    const delays = Array.from({ length: MAX_POLL_ATTEMPTS }, (_, attempt) => nextPollDelay(attempt));
    expect(delays).toEqual([3000, 6000, 12000, 30000, 30000, 30000, 30000, 30000]);
  });

  it('gives up once the attempt budget is spent', () => {
    expect(nextPollDelay(MAX_POLL_ATTEMPTS)).toBeNull();
    expect(nextPollDelay(MAX_POLL_ATTEMPTS + 10)).toBeNull();
  });

  it('refuses a negative attempt count', () => {
    expect(nextPollDelay(-1)).toBeNull();
  });

  it('accepts a custom schedule and budget', () => {
    expect(nextPollDelay(0, [100, 200], 3)).toBe(100);
    expect(nextPollDelay(1, [100, 200], 3)).toBe(200);
    expect(nextPollDelay(2, [100, 200], 3)).toBe(200);
    expect(nextPollDelay(3, [100, 200], 3)).toBeNull();
  });

  it('has nothing to wait for with an empty schedule or a zero budget', () => {
    expect(nextPollDelay(0, [], 5)).toBeNull();
    expect(nextPollDelay(0, [100], 0)).toBeNull();
  });

  it('starts with the shortest delay and never shrinks', () => {
    for (let i = 1; i < POLL_DELAYS_MS.length; i++) {
      expect(POLL_DELAYS_MS[i]).toBeGreaterThanOrEqual(POLL_DELAYS_MS[i - 1]);
    }
  });
});

describe('shouldPoll', () => {
  it('is true only while the payment outcome is unknown', () => {
    expect(shouldPoll('payment_pending')).toBe(true);
    const others: OrderStatus[] = ['pending', 'confirmed', 'payment_failed', 'cancelled', 'review_required'];
    for (const status of others) expect(shouldPoll(status)).toBe(false);
  });
});

describe('totalPollWindowMs', () => {
  it('adds up every wait in the default schedule', () => {
    expect(totalPollWindowMs()).toBe(3000 + 6000 + 12000 + 30000 * 5);
  });

  it('follows a custom schedule', () => {
    expect(totalPollWindowMs([1000], 3)).toBe(3000);
    expect(totalPollWindowMs([10, 20], 3)).toBe(50);
  });

  it('is zero without attempts', () => {
    expect(totalPollWindowMs(POLL_DELAYS_MS, 0)).toBe(0);
  });
});
