import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_QUERY,
  MAX_SEARCH_LENGTH,
  PAGE_SIZES,
  SORT_KEYS,
  parseDayStart,
} from './invoicesQuery';
import type { InvoiceQuery, InvoiceSortKey, SortDirection } from './invoicesQuery';

// Typing "12." into the amount box must survive a round trip through the URL, so the shape check
// here allows a trailing dot. Anything else that is not an amount is dropped.
const AMOUNT_TEXT_RE = /^\d{1,12}(\.\d{0,2})?$/;
const PAGE_RE = /^\d{1,6}$/;

function readSort(value: string | null): InvoiceSortKey {
  return SORT_KEYS.find((key) => key === value) ?? DEFAULT_QUERY.sort;
}

function readDir(value: string | null): SortDirection {
  return value === 'asc' || value === 'desc' ? value : DEFAULT_QUERY.dir;
}

function readDate(value: string | null): string {
  return value !== null && parseDayStart(value) !== null ? value : '';
}

/** True for text that is a complete or partly typed amount such as `12`, `12.` or `12.5`. */
export function isAmountText(value: string): boolean {
  return AMOUNT_TEXT_RE.test(value);
}

function readAmount(value: string | null): string {
  return value !== null && isAmountText(value) ? value : '';
}

function readPage(value: string | null): number {
  if (value === null || !PAGE_RE.test(value)) return 1;
  return Math.max(1, Number(value));
}

function readPageSize(value: string | null): number {
  const size = value !== null && PAGE_RE.test(value) ? Number(value) : NaN;
  return PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE;
}

/** Reads a query from the URL. Missing, malformed or tampered values fall back to defaults. */
export function parseInvoiceQuery(params: URLSearchParams): InvoiceQuery {
  return {
    search: (params.get('q') ?? '').slice(0, MAX_SEARCH_LENGTH),
    from: readDate(params.get('from')),
    to: readDate(params.get('to')),
    min: readAmount(params.get('min')),
    max: readAmount(params.get('max')),
    sort: readSort(params.get('sort')),
    dir: readDir(params.get('dir')),
    page: readPage(params.get('page')),
    pageSize: readPageSize(params.get('size')),
  };
}

/** Writes only the values that differ from the defaults, so the plain list keeps a clean URL. */
export function serializeInvoiceQuery(query: InvoiceQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search !== '') params.set('q', query.search);
  if (query.from !== '') params.set('from', query.from);
  if (query.to !== '') params.set('to', query.to);
  if (query.min !== '') params.set('min', query.min);
  if (query.max !== '') params.set('max', query.max);
  if (query.sort !== DEFAULT_QUERY.sort) params.set('sort', query.sort);
  if (query.dir !== DEFAULT_QUERY.dir) params.set('dir', query.dir);
  if (query.page !== DEFAULT_QUERY.page) params.set('page', String(query.page));
  if (query.pageSize !== DEFAULT_QUERY.pageSize) params.set('size', String(query.pageSize));
  return params;
}
