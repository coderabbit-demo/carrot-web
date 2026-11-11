import { createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from '../../../lib/api/types';
import { orderActions } from '../orderActions';
import { OrderActions } from './OrderActions';
import { OrderLinesTable } from './OrderLinesTable';
import { OrderStatusBanner } from './OrderStatusBanner';
import { statusBanner } from './orderDetailModel';

const usd = (amount_minor: number) => ({ amount_minor, currency: 'USD' });

const baseOrder: Order = {
  id: 'o1',
  number: 'ORD-100001',
  status: 'confirmed',
  lines: [
    {
      product_id: 'p1',
      sku: 'CAR-001',
      name: 'Rainbow carrots',
      quantity_kg: 120,
      unit_price: usd(175),
      line_total: usd(21000),
    },
    {
      product_id: 'p2',
      sku: 'BET-002',
      name: 'Beetroot <b>',
      quantity_kg: 30,
      unit_price: usd(210),
      line_total: usd(6300),
    },
  ],
  total: usd(27300),
  invoice_id: null,
  failure_code: null,
  created_at: '2024-05-01T10:00:00Z',
  updated_at: '2024-05-01T10:00:00Z',
};

function render(element: ReactElement): string {
  return renderToStaticMarkup(createElement(MemoryRouter, null, element));
}

describe('OrderStatusBanner', () => {
  const banner = statusBanner('payment_pending');

  it('renders the message with the tone class and a status role', () => {
    if (!banner) throw new Error('expected a banner');
    const html = render(createElement(OrderStatusBanner, { banner }));
    expect(html).toContain('banner-warning');
    expect(html).toContain('role="status"');
    expect(html).toContain('confirming your payment');
    expect(html).toContain('no-print');
  });

  it('adds notes beneath the message and skips empty ones', () => {
    if (!banner) throw new Error('expected a banner');
    const html = render(
      createElement(OrderStatusBanner, { banner, notes: ['Still waiting.', null, ''] }),
    );
    expect(html).toContain('<p class="banner-meta">Still waiting.</p>');
    expect(html.match(/banner-meta/g)).toHaveLength(1);
  });

  it('renders the controls it is given', () => {
    if (!banner) throw new Error('expected a banner');
    const html = render(
      createElement(OrderStatusBanner, { banner }, createElement('button', null, 'Check payment status')),
    );
    expect(html).toContain('Check payment status');
  });
});

describe('OrderLinesTable', () => {
  it('shows each line, the server total and a summary', () => {
    const html = render(createElement(OrderLinesTable, { order: baseOrder }));
    expect(html).toContain('Rainbow carrots');
    expect(html).toContain('CAR-001');
    expect(html).toContain('$273.00');
    expect(html).toContain('$210.00');
    expect(html).toContain('2 products · 150 kg');
    expect(html).toContain('Products in order ORD-100001');
  });

  it('escapes product names', () => {
    const html = render(createElement(OrderLinesTable, { order: baseOrder }));
    expect(html).toContain('Beetroot &lt;b&gt;');
    expect(html).not.toContain('Beetroot <b>');
  });

  it('labels the column headers', () => {
    const html = render(createElement(OrderLinesTable, { order: baseOrder }));
    expect(html.match(/<th scope="col"/g)).toHaveLength(4);
  });
});

describe('OrderActions', () => {
  const props = (order: Order, role: 'admin' | 'buyer' = 'buyer') => ({
    order,
    capabilities: orderActions(order.status, role),
    cancelling: false,
    onCancel: vi.fn(),
    onPrint: vi.fn(),
  });

  it('always offers print and copy, and hides itself when printing', () => {
    const html = render(createElement(OrderActions, props(baseOrder)));
    expect(html).toContain('Print receipt');
    expect(html).toContain('Copy order number');
    expect(html).toContain('aria-label="Copy order number ORD-100001"');
    expect(html).toContain('no-print');
  });

  it('offers cancel only to admins on a pending order', () => {
    const pending: Order = { ...baseOrder, status: 'pending' };
    expect(render(createElement(OrderActions, props(pending, 'admin')))).toContain('Cancel order');
    expect(render(createElement(OrderActions, props(pending, 'buyer')))).not.toContain('Cancel order');
    expect(render(createElement(OrderActions, props(baseOrder, 'admin')))).not.toContain('Cancel order');
  });

  it('offers the invoice download only when the order has an invoice', () => {
    expect(render(createElement(OrderActions, props(baseOrder)))).not.toContain('Download invoice');
    const invoiced: Order = { ...baseOrder, invoice_id: 'inv-1' };
    expect(render(createElement(OrderActions, props(invoiced)))).toContain('Download invoice');
  });

  it('shows a busy cancel button while cancelling', () => {
    const pending: Order = { ...baseOrder, status: 'pending' };
    const html = render(
      createElement(OrderActions, { ...props(pending, 'admin'), cancelling: true }),
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled');
  });
});
