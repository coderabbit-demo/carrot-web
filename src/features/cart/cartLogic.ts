import type { Money, StockShortage } from '../../lib/api/types';
import { multiply, sum } from '../../lib/money';

export const MIN_QUANTITY_KG = 1;
export const MAX_QUANTITY_KG = 5000;
export const MAX_LINES = 20;

export interface CartLine {
  product_id: string;
  sku: string;
  name: string;
  /** Price seen when the item was added. A preview only; the server prices the order. */
  unit_price: Money;
  quantity_kg: number;
}

export function validateQuantity(quantity: number): string | null {
  if (!Number.isInteger(quantity)) return 'Enter a whole number of kilograms.';
  if (quantity < MIN_QUANTITY_KG || quantity > MAX_QUANTITY_KG) {
    return `Quantity must be between ${MIN_QUANTITY_KG} and ${MAX_QUANTITY_KG} kg.`;
  }
  return null;
}

export type ParsedQuantity = { ok: true; value: number } | { ok: false; error: string };

export function parseQuantityInput(raw: string): ParsedQuantity {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return { ok: false, error: 'Enter a whole number of kilograms.' };
  const value = Number(text);
  const error = validateQuantity(value);
  return error ? { ok: false, error } : { ok: true, value };
}

/** True when any quantity input text would be rejected by parseQuantityInput. */
export function hasInvalidDraft(drafts: string[]): boolean {
  return drafts.some((draft) => !parseQuantityInput(draft).ok);
}

export function addLine(
  lines: CartLine[],
  line: CartLine,
): { lines: CartLine[]; error: string | null } {
  const existing = lines.find((l) => l.product_id === line.product_id);
  if (existing) {
    const quantity = existing.quantity_kg + line.quantity_kg;
    const error = validateQuantity(quantity);
    if (error) return { lines, error };
    return {
      lines: lines.map((l) => (l === existing ? { ...l, quantity_kg: quantity } : l)),
      error: null,
    };
  }
  const error = validateQuantity(line.quantity_kg);
  if (error) return { lines, error };
  if (lines.length >= MAX_LINES) {
    return { lines, error: `A cart can hold at most ${MAX_LINES} different products.` };
  }
  return { lines: [...lines, line], error: null };
}

export function setLineQuantity(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  return lines.map((l) => (l.product_id === productId ? { ...l, quantity_kg: quantity } : l));
}

export function removeLine(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((l) => l.product_id !== productId);
}

export function lineTotal(line: CartLine): Money {
  return multiply(line.unit_price, line.quantity_kg);
}

export function cartTotal(lines: CartLine[]): Money {
  return sum(lines.map(lineTotal));
}

/** Lowers quantities to what the server says is available and drops products with none left. */
export function adjustToAvailability(lines: CartLine[], shortages: StockShortage[]): CartLine[] {
  const availableById = new Map(shortages.map((s) => [s.product_id, s.available_kg]));
  const adjusted: CartLine[] = [];
  for (const line of lines) {
    const available = availableById.get(line.product_id);
    if (available === undefined) {
      adjusted.push(line);
    } else if (available >= MIN_QUANTITY_KG) {
      adjusted.push({ ...line, quantity_kg: Math.min(line.quantity_kg, available) });
    }
  }
  return adjusted;
}

/** Identifies the order request a cart would produce; used to decide when a new idempotency key is needed. */
export function cartSignature(lines: CartLine[]): string {
  return [...lines]
    .sort((a, b) => a.product_id.localeCompare(b.product_id))
    .map((l) => `${l.product_id}:${l.quantity_kg}`)
    .join('|');
}

function isStoredLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const price = v.unit_price as Record<string, unknown> | undefined;
  return (
    typeof v.product_id === 'string' &&
    typeof v.sku === 'string' &&
    typeof v.name === 'string' &&
    typeof v.quantity_kg === 'number' &&
    validateQuantity(v.quantity_kg) === null &&
    typeof price === 'object' &&
    price !== null &&
    Number.isInteger(price.amount_minor) &&
    typeof price.currency === 'string'
  );
}

export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const lines: CartLine[] = [];
    for (const item of parsed) {
      if (!isStoredLine(item) || seen.has(item.product_id)) continue;
      seen.add(item.product_id);
      lines.push(item);
      if (lines.length === MAX_LINES) break;
    }
    return lines;
  } catch {
    return [];
  }
}
