import { describe, expect, it } from 'vitest';
import {
  MAX_LINES,
  addLine,
  adjustToAvailability,
  cartSignature,
  cartTotal,
  parseQuantityInput,
  parseStoredCart,
  validateQuantity,
} from './cartLogic';
import type { CartLine } from './cartLogic';

function line(id: string, quantity_kg: number, cents = 175): CartLine {
  return {
    product_id: id,
    sku: `SKU-${id}`,
    name: `Product ${id}`,
    unit_price: { amount_minor: cents, currency: 'USD' },
    quantity_kg,
  };
}

describe('quantity validation', () => {
  it('accepts whole kilograms from 1 to 5000', () => {
    expect(validateQuantity(1)).toBeNull();
    expect(validateQuantity(5000)).toBeNull();
  });

  it('rejects out-of-range and fractional values', () => {
    expect(validateQuantity(0)).not.toBeNull();
    expect(validateQuantity(5001)).not.toBeNull();
    expect(validateQuantity(2.5)).not.toBeNull();
    expect(validateQuantity(-3)).not.toBeNull();
  });

  it('parses text input strictly', () => {
    expect(parseQuantityInput(' 40 ')).toEqual({ ok: true, value: 40 });
    expect(parseQuantityInput('4.5').ok).toBe(false);
    expect(parseQuantityInput('').ok).toBe(false);
    expect(parseQuantityInput('1e3').ok).toBe(false);
    expect(parseQuantityInput('-5').ok).toBe(false);
  });
});

describe('cartTotal', () => {
  it('sums unit price times quantity in integer cents', () => {
    expect(cartTotal([line('a', 120, 175), line('b', 40, 280)])).toEqual({
      amount_minor: 32200,
      currency: 'USD',
    });
  });

  it('is zero for an empty cart', () => {
    expect(cartTotal([]).amount_minor).toBe(0);
  });
});

describe('addLine', () => {
  it('merges quantities for the same product', () => {
    const result = addLine([line('a', 10)], line('a', 5));
    expect(result.error).toBeNull();
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].quantity_kg).toBe(15);
  });

  it('refuses to go over 5000 kg for one product', () => {
    const result = addLine([line('a', 4999)], line('a', 2));
    expect(result.error).not.toBeNull();
    expect(result.lines[0].quantity_kg).toBe(4999);
  });

  it('allows at most 20 lines', () => {
    const full = Array.from({ length: MAX_LINES }, (_, i) => line(`p${i}`, 1));
    expect(addLine(full, line('extra', 1)).error).not.toBeNull();
    expect(addLine(full, line('p3', 1)).error).toBeNull();
  });
});

describe('adjustToAvailability', () => {
  it('lowers quantities and drops sold-out products', () => {
    const lines = [line('a', 100), line('b', 50), line('c', 10)];
    const adjusted = adjustToAvailability(lines, [
      { product_id: 'a', requested_kg: 100, available_kg: 60 },
      { product_id: 'b', requested_kg: 50, available_kg: 0 },
    ]);
    expect(adjusted.map((l) => [l.product_id, l.quantity_kg])).toEqual([
      ['a', 60],
      ['c', 10],
    ]);
  });
});

describe('cartSignature', () => {
  it('ignores order but changes with quantities', () => {
    const a = cartSignature([line('a', 1), line('b', 2)]);
    expect(cartSignature([line('b', 2), line('a', 1)])).toBe(a);
    expect(cartSignature([line('a', 1), line('b', 3)])).not.toBe(a);
  });
});

describe('parseStoredCart', () => {
  it('restores valid lines and drops malformed ones', () => {
    const raw = JSON.stringify([line('a', 5), { product_id: 'x' }, line('a', 7), line('b', 0)]);
    const restored = parseStoredCart(raw);
    expect(restored).toHaveLength(1);
    expect(restored[0].quantity_kg).toBe(5);
  });

  it('returns an empty cart for bad JSON', () => {
    expect(parseStoredCart('not json')).toEqual([]);
    expect(parseStoredCart(null)).toEqual([]);
  });
});
