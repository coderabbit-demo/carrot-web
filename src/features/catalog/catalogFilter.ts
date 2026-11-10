import type { Product } from '../../lib/api/types';

export function filterProducts(products: Product[], query: string): Product[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return products;
  return products.filter(
    (p) => p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle),
  );
}
