import { createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Membership, Order, OrderStatus } from '../../lib/api/types';
import { ApiError } from '../../lib/api/client';
import { AsyncSection } from './AsyncSection';
import { AttentionList } from './AttentionList';
import { MembershipSummary } from './MembershipSummary';
import { InvoiceSummaryCards, OrderSummaryCards } from './SummaryCards';
import { summarizeInvoices, summarizeOrders } from './overviewStats';

const usd = (amount_minor: number) => ({ amount_minor, currency: 'USD' });

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

function render(element: ReactElement): string {
  return renderToStaticMarkup(createElement(MemoryRouter, null, element));
}

describe('AttentionList', () => {
  it('shows a clear message when nothing needs attention', () => {
    const html = render(createElement(AttentionList, { orders: [] }));
    expect(html).toContain('Nothing needs attention');
    expect(html).not.toContain('<ul');
  });

  it('links each order to its detail page and explains the status', () => {
    const html = render(
      createElement(AttentionList, {
        orders: [order('a1', 'payment_pending'), order('b2', 'review_required')],
      }),
    );
    expect(html).toContain('href="/orders/a1"');
    expect(html).toContain('href="/orders/b2"');
    expect(html).toContain('Order ORD-a1');
    expect(html).toContain('Waiting for the payment to be confirmed.');
    expect(html).toContain('Paid, but the order needs a manual review.');
    expect(html).toContain('2 orders need attention');
  });

  it('uses the singular for one order', () => {
    const html = render(createElement(AttentionList, { orders: [order('1', 'payment_failed')] }));
    expect(html).toContain('1 order needs attention');
  });

  it('encodes ids in the link target', () => {
    const html = render(createElement(AttentionList, { orders: [order('a/b c', 'payment_failed')] }));
    expect(html).toContain('href="/orders/a%2Fb%20c"');
  });

  it('truncates the list and points at the orders page', () => {
    const orders = [order('1', 'payment_failed'), order('2', 'payment_failed'), order('3', 'payment_failed')];
    const html = render(createElement(AttentionList, { orders, visible: 1 }));
    expect(html).toContain('Order ORD-1');
    expect(html).not.toContain('Order ORD-2');
    expect(html).toContain('and 2 more.');
    expect(html).toContain('href="/orders"');
  });
});

describe('OrderSummaryCards', () => {
  it('shows a count for every status', () => {
    const summary = summarizeOrders([
      order('1', 'confirmed'),
      order('2', 'confirmed'),
      order('3', 'payment_pending'),
    ]);
    const html = render(createElement(OrderSummaryCards, { summary, limit: 100 }));
    expect(html).toContain('Confirmed');
    expect(html).toContain('Confirming payment');
    expect(html).toContain('Under review');
    expect(html).toContain('Cancelled');
    expect(html).toContain('<dd class="overview-figure">2</dd>');
    expect(html).toContain('Covers all 3 orders returned.');
  });

  it('renders the average through the money formatter', () => {
    const summary = summarizeOrders([
      order('1', 'confirmed', { total: usd(500) }),
      order('2', 'confirmed', { total: usd(501) }),
    ]);
    const html = render(createElement(OrderSummaryCards, { summary, limit: 100 }));
    expect(html).toContain('$5.01');
    expect(html).toContain('across 2 confirmed orders');
  });

  it('explains when there is no average to show', () => {
    const summary = summarizeOrders([order('1', 'payment_pending')]);
    const html = render(createElement(OrderSummaryCards, { summary, limit: 100 }));
    expect(html).toContain('No confirmed orders yet');
  });

  it('warns that a full list is not the whole history', () => {
    const summary = summarizeOrders([order('1', 'confirmed'), order('2', 'confirmed')]);
    const html = render(createElement(OrderSummaryCards, { summary, limit: 2 }));
    expect(html).toContain('Covers the 2 most recent orders. Older orders are not included.');
  });
});

describe('InvoiceSummaryCards', () => {
  const invoice = (id: string, amount: number, currency = 'USD') => ({
    id,
    number: `INV-${id}`,
    order_id: `o-${id}`,
    order_number: `ORD-${id}`,
    status: 'issued' as const,
    customer_name: 'Acme',
    lines: [],
    total: { amount_minor: amount, currency },
    issued_at: '2024-05-02T10:00:00Z',
  });

  it('shows the invoice count and billed total', () => {
    const summary = summarizeInvoices([invoice('1', 250025), invoice('2', 50025)]);
    const html = render(createElement(InvoiceSummaryCards, { summary, limit: 100 }));
    expect(html).toContain('Billed total');
    expect(html).toContain('$3,000.50');
    expect(html).toContain('<dd class="overview-figure">2</dd>');
  });

  it('labels each currency when there is more than one', () => {
    const summary = summarizeInvoices([invoice('1', 1000), invoice('2', 2000, 'EUR')]);
    const html = render(createElement(InvoiceSummaryCards, { summary, limit: 100 }));
    expect(html).toContain('EUR');
    expect(html).toContain('USD');
  });

  it('omits currency codes for a single currency', () => {
    const summary = summarizeInvoices([invoice('1', 1000)]);
    const html = render(createElement(InvoiceSummaryCards, { summary, limit: 100 }));
    expect(html).not.toContain('>USD<');
  });
});

describe('MembershipSummary', () => {
  const memberships: Membership[] = [
    { organization_id: 'o1', organization_name: 'Acme Kitchens', role: 'admin' },
    { organization_id: 'o2', organization_name: 'Bright Bakery', role: 'buyer' },
  ];

  it('names the current organization and lists the others', () => {
    const html = render(createElement(MembershipSummary, { memberships, currentOrganizationId: 'o1' }));
    expect(html).toContain('<strong>Acme Kitchens</strong>');
    expect(html).toContain('Your other organizations');
    expect(html).toContain('Bright Bakery');
    expect(html).toContain('Buyer');
  });

  it('omits the table when the user belongs to one organization only', () => {
    const html = render(
      createElement(MembershipSummary, { memberships: [memberships[0]], currentOrganizationId: 'o1' }),
    );
    expect(html).not.toContain('<table');
  });

  it('escapes organization names', () => {
    const html = render(
      createElement(MembershipSummary, {
        memberships: [
          memberships[0],
          { organization_id: 'o9', organization_name: '<img src=x onerror=alert(1)>', role: 'buyer' },
        ],
        currentOrganizationId: 'o1',
      }),
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('AsyncSection', () => {
  const base = { title: 'Orders', loadingLabel: 'Loading orders…', onRetry: () => undefined };
  const child = createElement('p', null, 'section body');

  it('shows a spinner while the first load is running', () => {
    const html = render(
      createElement(AsyncSection, { ...base, loading: true, error: null, hasData: false }, child),
    );
    expect(html).toContain('Loading orders…');
    expect(html).not.toContain('section body');
  });

  it('shows the error with a retry button and no body when the load failed', () => {
    const error = new ApiError({ code: 'server_error', message: 'boom', status: 500, requestId: 'req-1' });
    const html = render(createElement(AsyncSection, { ...base, loading: false, error, hasData: false }, child));
    expect(html).toContain('role="alert"');
    expect(html).toContain('Try again');
    expect(html).toContain('Reference: req-1');
    expect(html).not.toContain('section body');
  });

  it('shows the body once data is available', () => {
    const html = render(createElement(AsyncSection, { ...base, loading: false, error: null, hasData: true }, child));
    expect(html).toContain('section body');
    expect(html).not.toContain('role="alert"');
  });

  it('keeps stale data visible beside the error when a reload fails', () => {
    const error = new ApiError({ code: 'network_error', message: 'offline', status: 0 });
    const html = render(createElement(AsyncSection, { ...base, loading: false, error, hasData: true }, child));
    expect(html).toContain('section body');
    expect(html).toContain('role="alert"');
  });
});
