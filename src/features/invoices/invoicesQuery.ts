import type { Invoice } from '../../lib/api/types';

export type InvoiceSortKey = 'issued' | 'total' | 'number';
export type SortDirection = 'asc' | 'desc';

export const SORT_KEYS: readonly InvoiceSortKey[] = ['issued', 'total', 'number'];
export const PAGE_SIZES: readonly number[] = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_SEARCH_LENGTH = 100;

const DAY_MS = 86_400_000;

/**
 * Everything the list controls can express. Date and amount filters stay as the raw text the
 * user typed (or the URL carried); they are interpreted by the helpers below.
 */
export interface InvoiceQuery {
  search: string;
  /** Inclusive lower bound on the issue date, `YYYY-MM-DD`, or ''. */
  from: string;
  /** Inclusive upper bound on the issue date, `YYYY-MM-DD`, or ''. */
  to: string;
  /** Minimum total as a decimal string such as `12.50`, or ''. */
  min: string;
  /** Maximum total as a decimal string, or ''. */
  max: string;
  sort: InvoiceSortKey;
  dir: SortDirection;
  page: number;
  pageSize: number;
}

export const DEFAULT_QUERY: InvoiceQuery = {
  search: '',
  from: '',
  to: '',
  min: '',
  max: '',
  sort: 'issued',
  dir: 'desc',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const AMOUNT_RE = /^(\d{1,12})(?:\.(\d{0,2}))?$/;

/** Start of the given UTC calendar day in epoch milliseconds, or null if it is not a real date. */
export function parseDayStart(value: string): number | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

/** Turns "12", "12.5" or "12.50" into integer minor units without floating-point arithmetic. */
export function parseAmountMinor(value: string): number | null {
  const match = AMOUNT_RE.exec(value.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + fraction;
}

export interface QueryIssues {
  dateRange: string | null;
  totalRange: string | null;
}

export function validateQuery(query: InvoiceQuery): QueryIssues {
  const issues: QueryIssues = { dateRange: null, totalRange: null };

  const from = parseDayStart(query.from);
  const to = parseDayStart(query.to);
  if (from !== null && to !== null && from > to) {
    issues.dateRange = 'The "from" date is after the "to" date.';
  }

  const min = parseAmountMinor(query.min);
  const max = parseAmountMinor(query.max);
  if (min !== null && max !== null && min > max) {
    issues.totalRange = 'The minimum total is higher than the maximum total.';
  }
  return issues;
}

export function hasIssues(issues: QueryIssues): boolean {
  return issues.dateRange !== null || issues.totalRange !== null;
}

export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function hasActiveFilters(query: InvoiceQuery): boolean {
  return (
    normalizeSearch(query.search) !== '' ||
    parseDayStart(query.from) !== null ||
    parseDayStart(query.to) !== null ||
    parseAmountMinor(query.min) !== null ||
    parseAmountMinor(query.max) !== null
  );
}

export function filterInvoices(invoices: readonly Invoice[], query: InvoiceQuery): Invoice[] {
  const needle = normalizeSearch(query.search);
  const from = parseDayStart(query.from);
  const to = parseDayStart(query.to);
  const min = parseAmountMinor(query.min);
  const max = parseAmountMinor(query.max);
  // The upper bound is inclusive of the whole "to" day.
  const before = to === null ? null : to + DAY_MS;

  return invoices.filter((invoice) => {
    if (
      needle !== '' &&
      !invoice.number.toLowerCase().includes(needle) &&
      !invoice.order_number.toLowerCase().includes(needle)
    ) {
      return false;
    }
    if (from !== null || before !== null) {
      const issued = Date.parse(invoice.issued_at);
      if (Number.isNaN(issued)) return false;
      if (from !== null && issued < from) return false;
      if (before !== null && issued >= before) return false;
    }
    const total = invoice.total.amount_minor;
    if (min !== null && total < min) return false;
    if (max !== null && total > max) return false;
    return true;
  });
}

function compare<T extends number | string>(a: T, b: T): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function issuedMs(invoice: Invoice): number {
  const ms = Date.parse(invoice.issued_at);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

function compareNumbers(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}

function primary(a: Invoice, b: Invoice, sort: InvoiceSortKey): number {
  switch (sort) {
    case 'issued':
      return compare(issuedMs(a), issuedMs(b));
    case 'total':
      return compare(a.total.amount_minor, b.total.amount_minor);
    case 'number':
      return compareNumbers(a.number, b.number);
  }
}

/**
 * Returns a sorted copy. Ties fall back to invoice number and then id, both ascending whatever the
 * direction, so equal rows never swap places between renders.
 */
export function sortInvoices(
  invoices: readonly Invoice[],
  sort: InvoiceSortKey,
  dir: SortDirection,
): Invoice[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...invoices].sort((a, b) => {
    const byPrimary = primary(a, b, sort) * sign;
    if (byPrimary !== 0) return byPrimary;
    const byNumber = compareNumbers(a.number, b.number);
    if (byNumber !== 0) return byNumber;
    return compare(a.id, b.id);
  });
}

/** Clicking the active column flips direction; a new column starts in its natural direction. */
export function toggleSort(
  current: Pick<InvoiceQuery, 'sort' | 'dir'>,
  key: InvoiceSortKey,
): Pick<InvoiceQuery, 'sort' | 'dir'> {
  if (current.sort === key) return { sort: key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { sort: key, dir: key === 'number' ? 'asc' : 'desc' };
}

export interface Paged<T> {
  items: T[];
  /** The page actually shown, after clamping into range. */
  page: number;
  pageCount: number;
  /** 1-based position of the first and last item shown; both 0 for an empty list. */
  start: number;
  end: number;
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Paged<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const offset = (current - 1) * size;
  const slice = items.slice(offset, offset + size);
  return {
    items: slice,
    page: current,
    pageCount,
    start: slice.length === 0 ? 0 : offset + 1,
    end: offset + slice.length,
  };
}

/** Page buttons to render: first, last and the neighbours of the current page, with gaps between. */
export function pageWindow(page: number, pageCount: number): Array<number | 'gap'> {
  const wanted = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];
  pages.forEach((n, index) => {
    if (index > 0 && n - pages[index - 1] > 1) result.push('gap');
    result.push(n);
  });
  return result;
}

export interface InvoiceQueryResult {
  issues: QueryIssues;
  /** False when a range is inverted; no rows are produced in that case. */
  valid: boolean;
  /** Every row that matches, in display order. This is what the CSV export uses. */
  rows: Invoice[];
  paged: Paged<Invoice>;
}

export function runInvoiceQuery(invoices: readonly Invoice[], query: InvoiceQuery): InvoiceQueryResult {
  const issues = validateQuery(query);
  const valid = !hasIssues(issues);
  const rows = valid ? sortInvoices(filterInvoices(invoices, query), query.sort, query.dir) : [];
  return { issues, valid, rows, paged: paginate(rows, query.page, query.pageSize) };
}
