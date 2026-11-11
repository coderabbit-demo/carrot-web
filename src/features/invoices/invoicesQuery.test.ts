import { describe, expect, it } from 'vitest';
import type { Invoice } from '../../lib/api/types';
import {
  DEFAULT_QUERY,
  filterInvoices,
  hasActiveFilters,
  pageWindow,
  paginate,
  parseAmountMinor,
  parseDayStart,
  runInvoiceQuery,
  sortInvoices,
  toggleSort,
  validateQuery,
} from './invoicesQuery';
import type { InvoiceQuery } from './invoicesQuery';

function invoice(overrides: Partial<Invoice> & { id: string }): Invoice {
  return {
    number: 'INV-100001',
    order_id: `order-${overrides.id}`,
    order_number: 'ORD-200001',
    status: 'issued',
    customer_name: 'Acme Kitchens',
    lines: [],
    total: { amount_minor: 10000, currency: 'USD' },
    issued_at: '2024-03-10T12:00:00Z',
    ...overrides,
  };
}

const q = (overrides: Partial<InvoiceQuery> = {}): InvoiceQuery => ({ ...DEFAULT_QUERY, ...overrides });

const sample: Invoice[] = [
  invoice({
    id: 'a',
    number: 'INV-100001',
    order_number: 'ORD-200001',
    issued_at: '2024-03-01T09:00:00Z',
    total: { amount_minor: 12050, currency: 'USD' },
  }),
  invoice({
    id: 'b',
    number: 'INV-100002',
    order_number: 'ORD-200002',
    issued_at: '2024-03-15T23:30:00Z',
    total: { amount_minor: 99900, currency: 'USD' },
  }),
  invoice({
    id: 'c',
    number: 'INV-100010',
    order_number: 'ORD-200010',
    issued_at: '2024-04-02T00:00:00Z',
    total: { amount_minor: 500, currency: 'USD' },
  }),
  invoice({
    id: 'd',
    number: 'INV-100003',
    order_number: 'ORD-300003',
    issued_at: '2024-03-15T23:30:00Z',
    total: { amount_minor: 12050, currency: 'USD' },
  }),
];

const numbers = (list: Invoice[]) => list.map((i) => i.number);

describe('parseDayStart', () => {
  it('reads a real calendar date as the start of that UTC day', () => {
    expect(parseDayStart('2024-03-10')).toBe(Date.UTC(2024, 2, 10));
  });

  it('accepts a leap day only in leap years', () => {
    expect(parseDayStart('2024-02-29')).not.toBeNull();
    expect(parseDayStart('2023-02-29')).toBeNull();
  });

  it('rejects malformed or impossible dates', () => {
    expect(parseDayStart('')).toBeNull();
    expect(parseDayStart('2024-13-01')).toBeNull();
    expect(parseDayStart('2024-00-10')).toBeNull();
    expect(parseDayStart('2024-04-31')).toBeNull();
    expect(parseDayStart('10/03/2024')).toBeNull();
    expect(parseDayStart('0099-01-01')).toBeNull();
  });
});

describe('parseAmountMinor', () => {
  it('converts decimal text to integer minor units', () => {
    expect(parseAmountMinor('12')).toBe(1200);
    expect(parseAmountMinor('12.5')).toBe(1250);
    expect(parseAmountMinor('12.05')).toBe(1205);
    expect(parseAmountMinor('0.07')).toBe(7);
    expect(parseAmountMinor('12.')).toBe(1200);
    expect(parseAmountMinor(' 3.10 ')).toBe(310);
  });

  it('avoids floating point drift on awkward values', () => {
    expect(parseAmountMinor('19.99')).toBe(1999);
    expect(parseAmountMinor('1.15')).toBe(115);
    expect(parseAmountMinor('0.29')).toBe(29);
  });

  it('rejects anything that is not a plain non-negative amount', () => {
    expect(parseAmountMinor('')).toBeNull();
    expect(parseAmountMinor('.5')).toBeNull();
    expect(parseAmountMinor('-1')).toBeNull();
    expect(parseAmountMinor('1.234')).toBeNull();
    expect(parseAmountMinor('1e3')).toBeNull();
    expect(parseAmountMinor('abc')).toBeNull();
    expect(parseAmountMinor('1,000')).toBeNull();
    expect(parseAmountMinor('1234567890123')).toBeNull();
  });
});

describe('validateQuery', () => {
  it('reports nothing for a consistent query', () => {
    expect(validateQuery(q({ from: '2024-03-01', to: '2024-03-31', min: '1', max: '5' }))).toEqual({
      dateRange: null,
      totalRange: null,
    });
  });

  it('allows equal bounds and open-ended ranges', () => {
    const issues = validateQuery(q({ from: '2024-03-01', to: '2024-03-01', min: '5', max: '5' }));
    expect(issues).toEqual({ dateRange: null, totalRange: null });
    expect(validateQuery(q({ from: '2024-03-01' })).dateRange).toBeNull();
    expect(validateQuery(q({ max: '9' })).totalRange).toBeNull();
  });

  it('flags an inverted date range', () => {
    const issues = validateQuery(q({ from: '2024-04-01', to: '2024-03-01' }));
    expect(issues.dateRange).toMatch(/after/);
    expect(issues.totalRange).toBeNull();
  });

  it('flags an inverted total range', () => {
    const issues = validateQuery(q({ min: '20.00', max: '5' }));
    expect(issues.totalRange).toMatch(/minimum/);
    expect(issues.dateRange).toBeNull();
  });
});

describe('filterInvoices', () => {
  it('returns everything for the default query', () => {
    expect(filterInvoices(sample, q())).toHaveLength(4);
  });

  it('matches invoice number case-insensitively', () => {
    expect(numbers(filterInvoices(sample, q({ search: 'inv-100010' })))).toEqual(['INV-100010']);
  });

  it('matches order number and ignores surrounding whitespace', () => {
    expect(numbers(filterInvoices(sample, q({ search: '  ord-3000  ' })))).toEqual(['INV-100003']);
  });

  it('treats a whitespace-only search as no search', () => {
    expect(filterInvoices(sample, q({ search: '   ' }))).toHaveLength(4);
  });

  it('does not treat search text as a pattern', () => {
    expect(filterInvoices(sample, q({ search: '.*' }))).toHaveLength(0);
  });

  it('includes the whole "to" day and starts at the beginning of the "from" day', () => {
    const list = filterInvoices(sample, q({ from: '2024-03-15', to: '2024-03-15' }));
    expect(numbers(list)).toEqual(['INV-100002', 'INV-100003']);
  });

  it('excludes invoices issued before "from" or after "to"', () => {
    expect(numbers(filterInvoices(sample, q({ from: '2024-03-16' })))).toEqual(['INV-100010']);
    expect(numbers(filterInvoices(sample, q({ to: '2024-03-01' })))).toEqual(['INV-100001']);
  });

  it('filters by an inclusive total range in minor units', () => {
    expect(numbers(filterInvoices(sample, q({ min: '120.50', max: '120.50' })))).toEqual([
      'INV-100001',
      'INV-100003',
    ]);
    expect(numbers(filterInvoices(sample, q({ max: '5' })))).toEqual(['INV-100010']);
    expect(numbers(filterInvoices(sample, q({ min: '1000' })))).toEqual([]);
  });

  it('combines search with date and total filters', () => {
    const list = filterInvoices(
      sample,
      q({ search: 'inv-1000', from: '2024-03-01', to: '2024-03-31', min: '100', max: '1000' }),
    );
    expect(numbers(list)).toEqual(['INV-100001', 'INV-100002', 'INV-100003']);
    expect(numbers(filterInvoices(sample, q({ search: 'inv-1000', min: '1000' })))).toEqual([]);
  });

  it('drops rows with an unreadable date only when a date filter is active', () => {
    const odd = invoice({ id: 'x', number: 'INV-900000', issued_at: 'not a date' });
    expect(filterInvoices([odd], q())).toHaveLength(1);
    expect(filterInvoices([odd], q({ from: '2024-01-01' }))).toHaveLength(0);
  });

  it('does not mutate its input', () => {
    const copy = [...sample];
    filterInvoices(sample, q({ search: 'zzz' }));
    expect(sample).toEqual(copy);
  });
});

describe('sortInvoices', () => {
  it('sorts by issue date in both directions', () => {
    expect(numbers(sortInvoices(sample, 'issued', 'asc'))).toEqual([
      'INV-100001',
      'INV-100002',
      'INV-100003',
      'INV-100010',
    ]);
    expect(numbers(sortInvoices(sample, 'issued', 'desc'))).toEqual([
      'INV-100010',
      'INV-100002',
      'INV-100003',
      'INV-100001',
    ]);
  });

  it('sorts by total, breaking ties by invoice number ascending in either direction', () => {
    expect(numbers(sortInvoices(sample, 'total', 'asc'))).toEqual([
      'INV-100010',
      'INV-100001',
      'INV-100003',
      'INV-100002',
    ]);
    expect(numbers(sortInvoices(sample, 'total', 'desc'))).toEqual([
      'INV-100002',
      'INV-100001',
      'INV-100003',
      'INV-100010',
    ]);
  });

  it('sorts invoice numbers naturally rather than character by character', () => {
    const list = [
      invoice({ id: '1', number: 'INV-9' }),
      invoice({ id: '2', number: 'INV-10' }),
      invoice({ id: '3', number: 'INV-2' }),
    ];
    expect(numbers(sortInvoices(list, 'number', 'asc'))).toEqual(['INV-2', 'INV-9', 'INV-10']);
    expect(numbers(sortInvoices(list, 'number', 'desc'))).toEqual(['INV-10', 'INV-9', 'INV-2']);
  });

  it('falls back to id when number and sort value both tie', () => {
    const list = [
      invoice({ id: 'z', number: 'INV-1' }),
      invoice({ id: 'a', number: 'INV-1' }),
      invoice({ id: 'm', number: 'INV-1' }),
    ];
    expect(sortInvoices(list, 'total', 'desc').map((i) => i.id)).toEqual(['a', 'm', 'z']);
    expect(sortInvoices([...list].reverse(), 'total', 'asc').map((i) => i.id)).toEqual(['a', 'm', 'z']);
  });

  it('places unreadable dates before real ones when ascending', () => {
    const odd = invoice({ id: 'x', number: 'INV-900000', issued_at: 'garbage' });
    expect(sortInvoices([...sample, odd], 'issued', 'asc')[0].id).toBe('x');
  });

  it('returns a new array and leaves the input alone', () => {
    const input = [...sample];
    const out = sortInvoices(input, 'total', 'asc');
    expect(out).not.toBe(input);
    expect(input).toEqual(sample);
  });
});

describe('toggleSort', () => {
  it('flips direction on the active column', () => {
    expect(toggleSort({ sort: 'issued', dir: 'desc' }, 'issued')).toEqual({ sort: 'issued', dir: 'asc' });
    expect(toggleSort({ sort: 'issued', dir: 'asc' }, 'issued')).toEqual({ sort: 'issued', dir: 'desc' });
  });

  it('starts a new column in its natural direction', () => {
    expect(toggleSort({ sort: 'issued', dir: 'desc' }, 'number')).toEqual({ sort: 'number', dir: 'asc' });
    expect(toggleSort({ sort: 'number', dir: 'asc' }, 'total')).toEqual({ sort: 'total', dir: 'desc' });
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);

  it('slices a page and reports its position', () => {
    const p = paginate(items, 2, 10);
    expect(p.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(p).toMatchObject({ page: 2, pageCount: 3, start: 11, end: 20 });
  });

  it('returns a short last page', () => {
    const p = paginate(items, 3, 10);
    expect(p.items).toEqual([21, 22, 23]);
    expect(p).toMatchObject({ start: 21, end: 23 });
  });

  it('clamps an out-of-range page', () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate(items, -4, 10).page).toBe(1);
    expect(paginate(items, Number.NaN, 10).page).toBe(1);
  });

  it('handles an empty list', () => {
    expect(paginate([], 1, 25)).toEqual({ items: [], page: 1, pageCount: 1, start: 0, end: 0 });
  });

  it('guards against a zero page size', () => {
    expect(paginate(items, 1, 0).items).toEqual([1]);
  });

  it('fits everything on one page when the size is larger than the list', () => {
    expect(paginate(items, 1, 100)).toMatchObject({ pageCount: 1, start: 1, end: 23 });
  });
});

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it('collapses distant pages into gaps', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 'gap', 10]);
    expect(pageWindow(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageWindow(10, 10)).toEqual([1, 'gap', 9, 10]);
  });

  it('does not leave a gap between adjacent pages', () => {
    expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, 'gap', 10]);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the default and for whitespace or unusable values', () => {
    expect(hasActiveFilters(q())).toBe(false);
    expect(hasActiveFilters(q({ search: '  ', from: 'nope', min: 'x' }))).toBe(false);
  });

  it('is true when any filter has an effect', () => {
    expect(hasActiveFilters(q({ search: 'inv' }))).toBe(true);
    expect(hasActiveFilters(q({ from: '2024-01-01' }))).toBe(true);
    expect(hasActiveFilters(q({ max: '10' }))).toBe(true);
  });

  it('ignores sort and paging', () => {
    expect(hasActiveFilters(q({ sort: 'total', dir: 'asc', page: 4, pageSize: 10 }))).toBe(false);
  });
});

describe('runInvoiceQuery', () => {
  it('filters, sorts and pages in one step', () => {
    const result = runInvoiceQuery(sample, q({ sort: 'total', dir: 'desc', pageSize: 2 }));
    expect(result.valid).toBe(true);
    expect(numbers(result.rows)).toEqual(['INV-100002', 'INV-100001', 'INV-100003', 'INV-100010']);
    expect(numbers(result.paged.items)).toEqual(['INV-100002', 'INV-100001']);
    expect(result.paged.pageCount).toBe(2);
  });

  it('keeps the full filtered list in rows regardless of the page', () => {
    const result = runInvoiceQuery(sample, q({ page: 2, pageSize: 10 }));
    expect(result.rows).toHaveLength(4);
    expect(result.paged.page).toBe(1);
  });

  it('returns no rows and the issue for an inverted range', () => {
    const result = runInvoiceQuery(sample, q({ from: '2024-04-01', to: '2024-03-01' }));
    expect(result.valid).toBe(false);
    expect(result.issues.dateRange).not.toBeNull();
    expect(result.rows).toEqual([]);
    expect(result.paged.items).toEqual([]);
  });

  it('returns an empty but valid result when nothing matches', () => {
    const result = runInvoiceQuery(sample, q({ search: 'no-such-invoice' }));
    expect(result.valid).toBe(true);
    expect(result.rows).toEqual([]);
    expect(result.paged).toMatchObject({ page: 1, pageCount: 1, start: 0, end: 0 });
  });

  it('copes with an empty invoice list', () => {
    const result = runInvoiceQuery([], q());
    expect(result.valid).toBe(true);
    expect(result.rows).toEqual([]);
  });
});
