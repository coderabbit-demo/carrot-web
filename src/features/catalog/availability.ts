export const LOW_STOCK_KG = 100;

export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock';

export function availabilityOf(availableKg: number): Availability {
  if (availableKg <= 0) return 'out_of_stock';
  if (availableKg < LOW_STOCK_KG) return 'low_stock';
  return 'in_stock';
}

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
};
