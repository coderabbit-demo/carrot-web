import { isRetryable, userMessage } from '../../lib/api/client';
import type { ApiError } from '../../lib/api/client';
import type { StockShortage } from '../../lib/api/types';

export type CheckoutFailureKind =
  | 'declined'
  | 'insufficient_stock'
  | 'conflict'
  | 'unauthenticated'
  | 'retry'
  | 'other';

export interface CheckoutFailure {
  kind: CheckoutFailureKind;
  message: string;
  /** True when the attempt reached a final answer, so the next try needs a new Idempotency-Key. */
  terminal: boolean;
  items: StockShortage[];
  orderId?: string;
}

export function stockShortages(error: ApiError): StockShortage[] {
  const raw = error.details?.items;
  if (!Array.isArray(raw)) return [];
  const result: StockShortage[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { product_id, requested_kg, available_kg } = item as Record<string, unknown>;
    if (
      typeof product_id === 'string' &&
      typeof requested_kg === 'number' &&
      typeof available_kg === 'number'
    ) {
      result.push({ product_id, requested_kg, available_kg });
    }
  }
  return result;
}

export function describeCheckoutError(error: ApiError): CheckoutFailure {
  const base = { items: [] as StockShortage[] };

  if (error.code === 'payment_declined') {
    const orderId = error.details?.order_id;
    return {
      ...base,
      kind: 'declined',
      terminal: true,
      message: 'Your payment was declined, so the order was not placed. Nothing was charged.',
      orderId: typeof orderId === 'string' ? orderId : undefined,
    };
  }
  if (error.code === 'insufficient_stock') {
    return {
      ...base,
      kind: 'insufficient_stock',
      terminal: true,
      message: 'Some items no longer have enough stock.',
      items: stockShortages(error),
    };
  }
  if (error.code === 'idempotency_conflict') {
    return {
      ...base,
      kind: 'conflict',
      terminal: true,
      message: 'We could not match this checkout to your earlier attempt. Please place the order again.',
    };
  }
  if (error.code === 'unauthenticated') {
    return {
      ...base,
      kind: 'unauthenticated',
      terminal: false,
      message: 'Your session has expired. Sign in again to finish checkout.',
    };
  }
  if (isRetryable(error)) {
    return {
      ...base,
      kind: 'retry',
      terminal: false,
      message: `${userMessage(error)} Your order may or may not have been received. Trying again is safe: the same request is replayed, so you will not be charged twice.`,
    };
  }
  return { ...base, kind: 'other', terminal: true, message: userMessage(error) };
}
