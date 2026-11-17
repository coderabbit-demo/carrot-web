import { describe, expect, it } from 'vitest';
import type { Invoice } from '../../lib/api/types';
import {
  CSV_HEADER,
  buildInvoicesCsv,
  escapeCsvField,
  exportFilename,
  formatMinorAsDecimal,
  invoiceToCsvRow,
} from './invoicesCsv';

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    number: 'INV-100001',
    order_id: 'ord-1',
    order_number: 'ORD-200001',
    status: 'issued',
    customer_name: 'Acme Kitchens',
    lines: [],
    total: { amount_minor: 12050, currency: 'USD' },
    issued_at: '2024-03-01T09:00:00Z',
    ...overrides,
  };
}

describe('formatMinorAsDecimal', () => {
  it('renders minor units with two decimals', () => {
    expect(formatMinorAsDecimal(12050)).toBe('120.50');
    expect(formatMinorAsDecimal(100)).toBe('1.00');
  });

  it('pads amounts below one unit', () => {
    expect(formatMinorAsDecimal(0)).toBe('0.00');
    expect(formatMinorAsDecimal(5)).toBe('0.05');
    expect(formatMinorAsDecimal(99)).toBe('0.99');
  });

  it('does not use thousands separators', () => {
    expect(formatMinorAsDecimal(123456789)).toBe('1234567.89');
  });

  it('is exact for values that floating point division would blur', () => {
    expect(formatMinorAsDecimal(1999)).toBe('19.99');
    expect(formatMinorAsDecimal(29)).toBe('0.29');
    expect(formatMinorAsDecimal(Number.MAX_SAFE_INTEGER)).toBe('90071992547409.91');
  });

  it('keeps the sign of negative amounts', () => {
    expect(formatMinorAsDecimal(-250)).toBe('-2.50');
    expect(formatMinorAsDecimal(-5)).toBe('-0.05');
  });

  it('rejects values that are not safe integers', () => {
    expect(() => formatMinorAsDecimal(12.5)).toThrow(RangeError);
    expect(() => formatMinorAsDecimal(Number.NaN)).toThrow(RangeError);
    expect(() => formatMinorAsDecimal(Number.MAX_SAFE_INTEGER + 2)).toThrow(RangeError);
  });
});

describe('escapeCsvField', () => {
  it('leaves plain text alone', () => {
    expect(escapeCsvField('INV-100001')).toBe('INV-100001');
    expect(escapeCsvField('')).toBe('');
  });

  it('quotes fields with commas', () => {
    expect(escapeCsvField('Acme, Inc.')).toBe('"Acme, Inc."');
  });

  it('doubles embedded quotes', () => {
    expect(escapeCsvField('The "big" order')).toBe('"The ""big"" order"');
  });

  it('quotes fields with line breaks', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
    expect(escapeCsvField('a\r\nb')).toBe('"a\r\nb"');
  });

  it('prefixes a single quote when a cell starts with a formula character', () => {
    expect(escapeCsvField('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(escapeCsvField('+1 555 0100')).toBe("'+1 555 0100");
    expect(escapeCsvField('-2+3')).toBe("'-2+3");
    expect(escapeCsvField('@cmd')).toBe("'@cmd");
    expect(escapeCsvField('\tTabbed')).toBe("'\tTabbed");
  });

  it('guards first and then quotes when both apply', () => {
    expect(escapeCsvField('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(escapeCsvField('=1,2')).toBe(`"'=1,2"`);
  });

  it('does not touch formula characters that are not at the start', () => {
    expect(escapeCsvField('a=b')).toBe('a=b');
    expect(escapeCsvField('x@y.test')).toBe('x@y.test');
  });
});

describe('invoiceToCsvRow', () => {
  it('lists the columns in header order', () => {
    expect(invoiceToCsvRow(invoice())).toEqual([
      'INV-100001',
      'ORD-200001',
      '2024-03-01T09:00:00Z',
      'Acme Kitchens',
      'USD',
      '120.50',
    ]);
    expect(CSV_HEADER).toHaveLength(invoiceToCsvRow(invoice()).length);
  });
});

describe('buildInvoicesCsv', () => {
  it('produces only the header for an empty list', () => {
    expect(buildInvoicesCsv([])).toBe('Invoice number,Order number,Issued at,Customer,Currency,Total\r\n');
  });

  it('writes one CRLF terminated row per invoice, in the order given', () => {
    const csv = buildInvoicesCsv([
      invoice({ id: 'b', number: 'INV-100002', total: { amount_minor: 5, currency: 'USD' } }),
      invoice({ id: 'a', number: 'INV-100001' }),
    ]);
    expect(csv).toBe(
      [
        'Invoice number,Order number,Issued at,Customer,Currency,Total',
        'INV-100002,ORD-200001,2024-03-01T09:00:00Z,Acme Kitchens,USD,0.05',
        'INV-100001,ORD-200001,2024-03-01T09:00:00Z,Acme Kitchens,USD,120.50',
        '',
      ].join('\r\n'),
    );
  });

  it('escapes customer names that contain separators, quotes or formulas', () => {
    const csv = buildInvoicesCsv([
      invoice({ customer_name: 'Smith, "Bob" & Sons' }),
      invoice({ customer_name: '=cmd|\' /C calc\'!A0' }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('"Smith, ""Bob"" & Sons"');
    expect(lines[2]).toContain("'=cmd|' /C calc'!A0");
  });

  it('keeps a multi-line field inside one quoted cell', () => {
    const csv = buildInvoicesCsv([invoice({ customer_name: 'Line one\nLine two' })]);
    expect(csv).toContain('"Line one\nLine two"');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

describe('exportFilename', () => {
  it('uses the UTC calendar date', () => {
    expect(exportFilename(new Date('2024-03-09T23:59:59Z'))).toBe('invoices-2024-03-09.csv');
    expect(exportFilename(new Date('2025-01-01T00:00:00Z'))).toBe('invoices-2025-01-01.csv');
  });
});
