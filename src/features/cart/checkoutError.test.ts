import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api/client';
import { describeCheckoutError } from './checkoutError';

const err = (code: string, status: number, details?: Record<string, unknown>) =>
  new ApiError({ code, message: code, status, details });

describe('describeCheckoutError', () => {
  it('reports per-product availability for insufficient_stock', () => {
    const result = describeCheckoutError(
      err('insufficient_stock', 409, {
        items: [{ product_id: 'p1', requested_kg: 50, available_kg: 20 }, { bogus: true }],
      }),
    );
    expect(result.kind).toBe('insufficient_stock');
    expect(result.terminal).toBe(true);
    expect(result.items).toEqual([{ product_id: 'p1', requested_kg: 50, available_kg: 20 }]);
  });

  it('keeps the order id of a declined payment', () => {
    const result = describeCheckoutError(err('payment_declined', 402, { order_id: 'o-1' }));
    expect(result).toMatchObject({ kind: 'declined', terminal: true, orderId: 'o-1' });
  });

  it('treats idempotency_conflict as final so the next attempt gets a new key', () => {
    expect(describeCheckoutError(err('idempotency_conflict', 409)).terminal).toBe(true);
  });

  it('keeps the key for expired sessions, timeouts and network failures', () => {
    expect(describeCheckoutError(err('unauthenticated', 401)).terminal).toBe(false);
    expect(describeCheckoutError(err('upstream_timeout', 504)).kind).toBe('retry');
    expect(describeCheckoutError(err('network_error', 0)).terminal).toBe(false);
  });
});
