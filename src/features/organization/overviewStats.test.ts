import { describe, expect, it } from 'vitest';
import type { Invoice, Membership, Order, OrderStatus } from '../../lib/api/types';
import {
  ATTENTION_STATUSES,
  ORDER_STATUSES,
  attentionHint,
  attentionOrders,
  averageOrderValues,
  countOrdersByStatus,
  coverageNote,
  divideRoundHalfUp,
  summarizeInvoices,
  summarizeMemberships,
  summarizeOrders,
  totalsByCurrency,
} from './overviewStats';

const usd = (amount_minor: number) => ({ amount_minor, currency: 'USD' });
const eur = (amount_minor: number) => ({ amount_minor, currency: 'EUR' });

function order(id: string, status: OrderStatus, overrides: Partial<Order> = {}): Order {
  return {
    id,
    number: `ORD-${id}`,
    status,
    lines: [],
    total: usd(1000),
    invoice_id: null,
    failure_code: null,
    created_at: '2024-05-01T10:00:00Z',
    updated_at: '2024-05-01T10:00:00Z',
    ...overrides,
  };
}

function invoice(id: string, total = usd(1000)): Invoice {
  return {
    id,
    number: `INV-${id}`,
    order_id: `o-${id}`,
    order_number: `ORD-${id}`,
    status: 'issued',
    customer_name: 'Acme Kitchens',
    lines: [],
    total,
    issued_at: '2024-05-02T10:00:00Z',
  };
}

describe('countOrdersByStatus', () => {
  it('starts every status at zero', () => {
    const counts = countOrdersByStatus([]);
    expect(Object.keys(counts).sort()).toEqual([...ORDER_STATUSES].sort());
    for (const status of ORDER_STATUSES) expect(counts[status]).toBe(0);
  });

  it('counts a mix of statuses', () => {
    const counts = countOrdersByStatus([
      order('1', 'confirmed'),
      order('2', 'confirmed'),
      order('3', 'payment_pending'),
      order('4', 'cancelled'),
      order('5', 'payment_failed'),
      order('6', 'confirmed'),
      order('7', 'review_required'),
      order('8', 'pending'),
    ]);
    expect(counts).toEqual({
      pending: 1,
      payment_pending: 1,
      confirmed: 3,
      payment_failed: 1,
      review_required: 1,
      cancelled: 1,
    });
  });

  it('ignores a status it does not know instead of inventing a bucket', () => {
    const unknown = order('9', 'confirmed', { status: 'mystery' as OrderStatus });
    const counts = countOrdersByStatus([unknown]);
    expect(Object.keys(counts)).toHaveLength(ORDER_STATUSES.length);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('attentionOrders', () => {
  it('keeps only payment_pending, review_required and payment_failed orders', () => {
    const orders = (['pending', 'payment_pending', 'confirmed', 'payment_failed', 'cancelled', 'review_required'] as const).map(
      (status, i) => order(String(i), status),
    );
    const result = attentionOrders(orders);
    expect(result.map((o) => o.status).sort()).toEqual([...ATTENTION_STATUSES].sort());
  });

  it('lists the newest first', () => {
    const result = attentionOrders([
      order('1', 'payment_failed', { created_at: '2024-05-01T10:00:00Z' }),
      order('2', 'payment_pending', { created_at: '2024-05-03T10:00:00Z' }),
      order('3', 'review_required', { created_at: '2024-05-02T10:00:00Z' }),
    ]);
    expect(result.map((o) => o.id)).toEqual(['2', '3', '1']);
  });

  it('orders equal timestamps by order number, highest first', () => {
    const same = '2024-05-01T10:00:00Z';
    const result = attentionOrders([
      order('9', 'payment_pending', { number: 'ORD-9', created_at: same }),
      order('10', 'payment_pending', { number: 'ORD-10', created_at: same }),
      order('2', 'payment_pending', { number: 'ORD-2', created_at: same }),
    ]);
    expect(result.map((o) => o.number)).toEqual(['ORD-10', 'ORD-9', 'ORD-2']);
  });

  it('puts unreadable dates last', () => {
    const result = attentionOrders([
      order('1', 'payment_pending', { created_at: 'garbage' }),
      order('2', 'payment_pending', { created_at: '2020-01-01T00:00:00Z' }),
    ]);
    expect(result.map((o) => o.id)).toEqual(['2', '1']);
  });

  it('returns an empty list when nothing needs attention', () => {
    expect(attentionOrders([order('1', 'confirmed'), order('2', 'cancelled')])).toEqual([]);
    expect(attentionOrders([])).toEqual([]);
  });

  it('does not reorder the caller\'s array', () => {
    const input = [
      order('1', 'payment_pending', { created_at: '2024-01-01T00:00:00Z' }),
      order('2', 'payment_pending', { created_at: '2024-02-01T00:00:00Z' }),
    ];
    attentionOrders(input);
    expect(input.map((o) => o.id)).toEqual(['1', '2']);
  });
});

describe('attentionHint', () => {
  it('has text for each attention status', () => {
    for (const status of ATTENTION_STATUSES) expect(attentionHint(status).length).toBeGreaterThan(0);
  });

  it('is empty for statuses that need nothing', () => {
    expect(attentionHint('confirmed')).toBe('');
    expect(attentionHint('cancelled')).toBe('');
  });
});

describe('totalsByCurrency', () => {
  it('is empty for no input', () => {
    expect(totalsByCurrency([])).toEqual([]);
  });

  it('adds integers exactly', () => {
    expect(totalsByCurrency([usd(10), usd(20), usd(30)])).toEqual([usd(60)]);
    expect(totalsByCurrency([usd(1), usd(2)])).toEqual([usd(3)]);
  });

  it('keeps currencies apart and sorts them by code', () => {
    expect(totalsByCurrency([usd(100), eur(5), usd(50), eur(7)])).toEqual([eur(12), usd(150)]);
  });

  it('handles large totals without losing precision', () => {
    const big = 4_000_000_000_000_000;
    expect(totalsByCurrency([usd(big), usd(big), usd(1)])).toEqual([usd(8_000_000_000_000_001)]);
  });

  it('refuses a total that cannot be represented exactly', () => {
    expect(() => totalsByCurrency([usd(Number.MAX_SAFE_INTEGER), usd(1)])).toThrow(RangeError);
  });
});

describe('divideRoundHalfUp', () => {
  it('divides evenly without adjustment', () => {
    expect(divideRoundHalfUp(1000, 4)).toBe(250);
    expect(divideRoundHalfUp(0, 3)).toBe(0);
  });

  it('rounds down below one half', () => {
    expect(divideRoundHalfUp(1000, 3)).toBe(333);
    expect(divideRoundHalfUp(9, 4)).toBe(2);
  });

  it('rounds exactly one half up', () => {
    expect(divideRoundHalfUp(1001, 2)).toBe(501);
    expect(divideRoundHalfUp(10, 4)).toBe(3);
    expect(divideRoundHalfUp(5, 2)).toBe(3);
    expect(divideRoundHalfUp(1, 2)).toBe(1);
  });

  it('rounds up above one half', () => {
    expect(divideRoundHalfUp(2000, 3)).toBe(667);
    expect(divideRoundHalfUp(11, 4)).toBe(3);
  });

  it('is exact for totals near the safe integer limit', () => {
    expect(divideRoundHalfUp(9_000_000_000_000_000, 3)).toBe(3_000_000_000_000_000);
    expect(divideRoundHalfUp(9_000_000_000_000_001, 3)).toBe(3_000_000_000_000_000);
    expect(divideRoundHalfUp(9_000_000_000_000_002, 3)).toBe(3_000_000_000_000_001);
  });

  it('rejects a zero or negative count and non-integer input', () => {
    expect(() => divideRoundHalfUp(10, 0)).toThrow(RangeError);
    expect(() => divideRoundHalfUp(10, -1)).toThrow(RangeError);
    expect(() => divideRoundHalfUp(10.5, 2)).toThrow(RangeError);
    expect(() => divideRoundHalfUp(10, 1.5)).toThrow(RangeError);
  });
});

describe('averageOrderValues', () => {
  it('is empty when there are no confirmed orders', () => {
    expect(averageOrderValues([])).toEqual([]);
    expect(averageOrderValues([order('1', 'payment_pending'), order('2', 'cancelled')])).toEqual([]);
  });

  it('averages only confirmed orders', () => {
    const result = averageOrderValues([
      order('1', 'confirmed', { total: usd(1000) }),
      order('2', 'confirmed', { total: usd(3000) }),
      order('3', 'cancelled', { total: usd(900000) }),
      order('4', 'payment_failed', { total: usd(500000) }),
    ]);
    expect(result).toEqual([{ currency: 'USD', orderCount: 2, average: usd(2000) }]);
  });

  it('rounds the average half up to a whole minor unit', () => {
    const result = averageOrderValues([
      order('1', 'confirmed', { total: usd(500) }),
      order('2', 'confirmed', { total: usd(501) }),
    ]);
    expect(result[0].average).toEqual(usd(501));
  });

  it('keeps a separate average for each currency', () => {
    const result = averageOrderValues([
      order('1', 'confirmed', { total: usd(1000) }),
      order('2', 'confirmed', { total: eur(300) }),
      order('3', 'confirmed', { total: eur(500) }),
    ]);
    expect(result).toEqual([
      { currency: 'EUR', orderCount: 2, average: eur(400) },
      { currency: 'USD', orderCount: 1, average: usd(1000) },
    ]);
  });

  it('copes with very large order totals', () => {
    const result = averageOrderValues([
      order('1', 'confirmed', { total: usd(4_000_000_000_000_000) }),
      order('2', 'confirmed', { total: usd(4_000_000_000_000_000) }),
    ]);
    expect(result[0].average).toEqual(usd(4_000_000_000_000_000));
  });
});

describe('summarizeOrders', () => {
  it('reports an empty summary', () => {
    expect(summarizeOrders([])).toEqual({
      orderCount: 0,
      statusCounts: countOrdersByStatus([]),
      attention: [],
      averages: [],
    });
  });

  it('combines counts, attention and averages', () => {
    const summary = summarizeOrders([
      order('1', 'confirmed', { total: usd(2000) }),
      order('2', 'payment_pending'),
      order('3', 'review_required'),
    ]);
    expect(summary.orderCount).toBe(3);
    expect(summary.statusCounts.confirmed).toBe(1);
    expect(summary.attention).toHaveLength(2);
    expect(summary.averages).toEqual([{ currency: 'USD', orderCount: 1, average: usd(2000) }]);
  });
});

describe('summarizeInvoices', () => {
  it('reports no invoices', () => {
    expect(summarizeInvoices([])).toEqual({ invoiceCount: 0, billed: [] });
  });

  it('counts invoices and totals the billed amount', () => {
    expect(summarizeInvoices([invoice('1', usd(1999)), invoice('2', usd(1)), invoice('3', usd(500))])).toEqual({
      invoiceCount: 3,
      billed: [usd(2500)],
    });
  });

  it('separates currencies', () => {
    const summary = summarizeInvoices([invoice('1', usd(100)), invoice('2', eur(200))]);
    expect(summary.billed).toEqual([eur(200), usd(100)]);
  });
});

describe('summarizeMemberships', () => {
  const memberships: Membership[] = [
    { organization_id: 'o3', organization_name: 'Zeta Foods', role: 'buyer' },
    { organization_id: 'o1', organization_name: 'Acme Kitchens', role: 'admin' },
    { organization_id: 'o2', organization_name: 'Bright Bakery', role: 'buyer' },
  ];

  it('splits the current organization from the rest and sorts the rest by name', () => {
    const summary = summarizeMemberships(memberships, 'o2');
    expect(summary.current?.organization_name).toBe('Bright Bakery');
    expect(summary.others.map((m) => m.organization_name)).toEqual(['Acme Kitchens', 'Zeta Foods']);
  });

  it('counts roles', () => {
    expect(summarizeMemberships(memberships, 'o1')).toMatchObject({ total: 3, adminCount: 1, buyerCount: 2 });
  });

  it('has no current membership when the id is unknown or missing', () => {
    expect(summarizeMemberships(memberships, 'nope').current).toBeNull();
    expect(summarizeMemberships(memberships, null).others).toHaveLength(3);
  });

  it('handles an empty list', () => {
    expect(summarizeMemberships([], 'o1')).toEqual({
      total: 0,
      adminCount: 0,
      buyerCount: 0,
      current: null,
      others: [],
    });
  });

  it('does not reorder the caller\'s array', () => {
    const copy = [...memberships];
    summarizeMemberships(memberships, 'o1');
    expect(memberships).toEqual(copy);
  });
});

describe('coverageNote', () => {
  it('says so when nothing came back', () => {
    expect(coverageNote('order', 0, 100)).toBe('No orders were returned.');
  });

  it('says all records are covered when the list is shorter than the limit', () => {
    expect(coverageNote('order', 12, 100)).toBe('Covers all 12 orders returned.');
    expect(coverageNote('invoice', 1, 100)).toBe('Covers all 1 invoice returned.');
  });

  it('calls the list partial once it reaches the limit', () => {
    expect(coverageNote('order', 100, 100)).toBe(
      'Covers the 100 most recent orders. Older orders are not included.',
    );
    expect(coverageNote('invoice', 120, 100)).toContain('most recent invoices');
  });

  it('treats a list one short of the limit as complete', () => {
    expect(coverageNote('order', 99, 100)).toBe('Covers all 99 orders returned.');
  });
});
