import type { OrderStatus } from '../../../lib/api/types';

/** Waits before each automatic re-check of a payment_pending order. The last value repeats. */
export const POLL_DELAYS_MS: readonly number[] = [3000, 6000, 12000, 30000];

/** Automatic checks stop after this many tries; the manual button is still there. */
export const MAX_POLL_ATTEMPTS = 8;

/** Only an order whose payment outcome is unknown is worth re-fetching on its own. */
export function shouldPoll(status: OrderStatus): boolean {
  return status === 'payment_pending';
}

/**
 * How long to wait before the next check, given how many checks have already run.
 * Returns null once the budget is spent.
 */
export function nextPollDelay(
  attemptsMade: number,
  delays: readonly number[] = POLL_DELAYS_MS,
  maxAttempts: number = MAX_POLL_ATTEMPTS,
): number | null {
  if (delays.length === 0 || attemptsMade < 0 || attemptsMade >= maxAttempts) return null;
  return delays[Math.min(attemptsMade, delays.length - 1)];
}

/** Total time the schedule can run for, useful for explaining it to people. */
export function totalPollWindowMs(
  delays: readonly number[] = POLL_DELAYS_MS,
  maxAttempts: number = MAX_POLL_ATTEMPTS,
): number {
  let total = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    total += nextPollDelay(attempt, delays, maxAttempts) ?? 0;
  }
  return total;
}
