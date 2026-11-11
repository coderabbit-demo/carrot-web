import { describe, expect, it } from 'vitest';
import type { LineItem, OrderStatus } from '../../../lib/api/types';
import {
  checkResultNote,
  invoiceNumberFor,
  linesSummary,
  orderTotals,
  pollingNote,
  statusBanner,
} from './orderDetailModel';

const line = (product_id: string, quantity_kg: number): LineItem => ({
  product_id,
  sku: `SKU-${product_id}`,
  name: `Product ${product_id}`,
  quantity_kg,
  unit_price: { amount_minor: 175, currency: 'USD' },
  line_total: { amount_minor: 175 * quantity_kg, currency: 'USD' },
});

describe('statusBanner', () => {
  it('explains a payment that is still being confirmed', () => {
    expect(statusBanner('payment_pending')).toEqual({
      kind: 'confirming',
      tone: 'warning',
      message: "We're confirming your payment. Your order is saved and the stock is held for you.",
    });
  });

  it('explains a declined payment as an error', () => {
    const banner = statusBanner('payment_failed');
    expect(banner?.kind).toBe('failed');
    expect(banner?.tone).toBe('error');
    expect(banner?.message).toContain('No charge was made');
  });

  it('flags a paid order that needs review as a warning', () => {
    const banner = statusBanner('review_required');
    expect(banner).toMatchObject({ kind: 'review', tone: 'warning' });
    expect(banner?.message).toContain('Our team will review it');
  });

  it('shows cancellation as information', () => {
    expect(statusBanner('cancelled')).toEqual({
      kind: 'cancelled',
      tone: 'info',
      message: 'This order was cancelled.',
    });
  });

  it('has no banner for pending or confirmed orders', () => {
    expect(statusBanner('pending')).toBeNull();
    expect(statusBanner('confirmed')).toBeNull();
  });

  it('never returns a banner for a status it does not know', () => {
    expect(statusBanner('toString' as OrderStatus)).toBeNull();
  });
});

describe('pollingNote', () => {
  it('says the page is waiting for the payment to resolve', () => {
    expect(pollingNote('waiting')).toContain('updates when the payment resolves');
  });

  it('says why checks are paused', () => {
    expect(pollingNote('paused')).toContain('in the background');
  });

  it('tells people to use the button once automatic checks gave up', () => {
    const note = pollingNote('exhausted');
    expect(note).toContain('about 3 minutes');
    expect(note).toContain('Use the button');
  });

  it('is silent when nothing is being polled', () => {
    expect(pollingNote('idle')).toBeNull();
    expect(pollingNote('stopped')).toBeNull();
  });
});

describe('checkResultNote', () => {
  it('asks to check again while the payment is undecided', () => {
    expect(checkResultNote('payment_pending')).toContain('check again in a moment');
  });

  it('has nothing to say once the status has changed', () => {
    const settled: OrderStatus[] = ['confirmed', 'payment_failed', 'review_required', 'cancelled', 'pending'];
    for (const status of settled) expect(checkResultNote(status)).toBeNull();
  });
});

describe('orderTotals', () => {
  it('counts lines and sums kilograms', () => {
    expect(orderTotals({ lines: [line('a', 120), line('b', 30), line('c', 5)] })).toEqual({
      lineCount: 3,
      totalKg: 155,
    });
  });

  it('is zero for an order without lines', () => {
    expect(orderTotals({ lines: [] })).toEqual({ lineCount: 0, totalKg: 0 });
  });
});

describe('linesSummary', () => {
  const kg = (n: number) => `${n} kg`;

  it('pluralizes the product count', () => {
    expect(linesSummary({ lineCount: 1, totalKg: 10 }, kg)).toBe('1 product · 10 kg');
    expect(linesSummary({ lineCount: 3, totalKg: 155 }, kg)).toBe('3 products · 155 kg');
    expect(linesSummary({ lineCount: 0, totalKg: 0 }, kg)).toBe('0 products · 0 kg');
  });

  it('uses the supplied formatter for weight', () => {
    expect(linesSummary({ lineCount: 2, totalKg: 1500 }, (n) => `${n.toLocaleString('en-US')} kg`)).toBe(
      '2 products · 1,500 kg',
    );
  });
});

describe('invoiceNumberFor', () => {
  it('maps an order number to its invoice number', () => {
    expect(invoiceNumberFor('ORD-100001')).toBe('INV-100001');
    expect(invoiceNumberFor('100002')).toBe('INV-100002');
  });

  it('keeps only the digits', () => {
    expect(invoiceNumberFor('ORD-1000-01')).toBe('INV-100001');
  });
});
