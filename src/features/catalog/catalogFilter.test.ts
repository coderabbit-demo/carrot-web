import { describe, expect, it } from 'vitest';
import type { Product } from '../../lib/api/types';
import { filterProducts } from './catalogFilter';

function product(id: string, sku: string, name: string): Product {
  return {
    id,
    sku,
    name,
    description: '',
    unit: 'kg',
    unit_price: { amount_minor: 175, currency: 'USD' },
    available_kg: 100,
  };
}

const products = [
  product('1', 'CAR-NAN-01', 'Nantes carrots'),
  product('2', 'CAR-IMP-02', 'Imperator carrots'),
  product('3', 'CAR-PUR-03', 'Purple Haze'),
];

describe('filterProducts', () => {
  it('matches on name', () => {
    expect(filterProducts(products, 'imperator').map((p) => p.id)).toEqual(['2']);
  });

  it('matches on SKU', () => {
    expect(filterProducts(products, 'pur-03').map((p) => p.id)).toEqual(['3']);
  });

  it('ignores case in both the query and the product', () => {
    expect(filterProducts(products, 'NANTES').map((p) => p.id)).toEqual(['1']);
    expect(filterProducts(products, 'car-imp').map((p) => p.id)).toEqual(['2']);
  });

  it('trims surrounding whitespace and returns everything for an empty query', () => {
    expect(filterProducts(products, '  purple  ').map((p) => p.id)).toEqual(['3']);
    expect(filterProducts(products, '')).toBe(products);
    expect(filterProducts(products, '   ')).toBe(products);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterProducts(products, 'beetroot')).toEqual([]);
  });
});
