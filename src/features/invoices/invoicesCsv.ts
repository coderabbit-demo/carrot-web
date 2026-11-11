import type { Invoice } from '../../lib/api/types';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

export const CSV_HEADER = [
  'Invoice number',
  'Order number',
  'Issued at',
  'Customer',
  'Currency',
  'Total',
] as const;

/** Renders integer minor units (cents) as a decimal string using string arithmetic only. */
export function formatMinorAsDecimal(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError('amount_minor must be a safe integer');
  }
  const negative = amountMinor < 0;
  const digits = String(Math.abs(amountMinor)).padStart(3, '0');
  const whole = digits.slice(0, -2);
  const cents = digits.slice(-2);
  return `${negative ? '-' : ''}${whole}.${cents}`;
}

/**
 * One CSV cell. A leading = + - @ (or tab / carriage return) would be run as a formula by
 * spreadsheet software, so such cells get a single quote in front. Fields are then quoted per
 * RFC 4180 when they hold a comma, quote or line break, with embedded quotes doubled.
 */
export function escapeCsvField(value: string): string {
  const guarded = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  if (NEEDS_QUOTES.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function invoiceToCsvRow(invoice: Invoice): string[] {
  return [
    invoice.number,
    invoice.order_number,
    invoice.issued_at,
    invoice.customer_name,
    invoice.total.currency,
    formatMinorAsDecimal(invoice.total.amount_minor),
  ];
}

/** CRLF separated, with a header row and a trailing line break, as RFC 4180 describes. */
export function buildInvoicesCsv(invoices: readonly Invoice[]): string {
  const lines = [CSV_HEADER as readonly string[], ...invoices.map(invoiceToCsvRow)];
  return lines.map((row) => row.map(escapeCsvField).join(',')).join('\r\n') + '\r\n';
}

export function exportFilename(date: Date): string {
  return `invoices-${date.toISOString().slice(0, 10)}.csv`;
}

/** Hands the CSV to the browser as a download. The BOM lets Excel read UTF-8 names correctly. */
export function saveCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
