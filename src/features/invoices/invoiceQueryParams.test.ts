import { describe, expect, it } from 'vitest';
import { isAmountText, parseInvoiceQuery, serializeInvoiceQuery } from './invoiceQueryParams';
import { DEFAULT_QUERY, MAX_SEARCH_LENGTH } from './invoicesQuery';
import type { InvoiceQuery } from './invoicesQuery';

const parse = (search: string) => parseInvoiceQuery(new URLSearchParams(search));

describe('parseInvoiceQuery', () => {
  it('returns the defaults for an empty query string', () => {
    expect(parse('')).toEqual(DEFAULT_QUERY);
  });

  it('reads every supported parameter', () => {
    expect(
      parse('q=INV-1&from=2024-03-01&to=2024-03-31&min=10&max=99.5&sort=total&dir=asc&page=3&size=50'),
    ).toEqual({
      search: 'INV-1',
      from: '2024-03-01',
      to: '2024-03-31',
      min: '10',
      max: '99.5',
      sort: 'total',
      dir: 'asc',
      page: 3,
      pageSize: 50,
    });
  });

  it('falls back for unknown sort keys and directions', () => {
    const query = parse('sort=customer&dir=sideways');
    expect(query.sort).toBe(DEFAULT_QUERY.sort);
    expect(query.dir).toBe(DEFAULT_QUERY.dir);
  });

  it('falls back for unusable page numbers', () => {
    for (const page of ['0', '-2', 'abc', '1.5', '', '1000000', '1e3']) {
      expect(parse(`page=${page}`).page).toBe(1);
    }
    expect(parse('page=999999').page).toBe(999999);
  });

  it('only accepts page sizes from the allowed list', () => {
    expect(parse('size=10').pageSize).toBe(10);
    expect(parse('size=7').pageSize).toBe(DEFAULT_QUERY.pageSize);
    expect(parse('size=100000').pageSize).toBe(DEFAULT_QUERY.pageSize);
    expect(parse('size=x').pageSize).toBe(DEFAULT_QUERY.pageSize);
  });

  it('drops dates that are malformed or not on the calendar', () => {
    expect(parse('from=yesterday&to=2024-02-30')).toMatchObject({ from: '', to: '' });
    expect(parse('from=2024-02-29')).toMatchObject({ from: '2024-02-29' });
  });

  it('drops amounts that are not plain decimals', () => {
    expect(parse('min=-5&max=1e9')).toMatchObject({ min: '', max: '' });
    expect(parse('min=1.234')).toMatchObject({ min: '' });
    expect(parse('min=12.&max=0.5')).toMatchObject({ min: '12.', max: '0.5' });
  });

  it('caps the length of the search text', () => {
    const long = 'x'.repeat(MAX_SEARCH_LENGTH + 50);
    expect(parse(`q=${long}`).search).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it('keeps markup in the search text as inert text', () => {
    expect(parse(`q=${encodeURIComponent('<img src=x onerror=alert(1)>')}`).search).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });

  it('uses the first value when a parameter is repeated', () => {
    expect(parse('sort=number&sort=total').sort).toBe('number');
  });
});

describe('serializeInvoiceQuery', () => {
  it('writes nothing for the default query', () => {
    expect(serializeInvoiceQuery(DEFAULT_QUERY).toString()).toBe('');
  });

  it('writes only the values that differ from the defaults', () => {
    const query: InvoiceQuery = { ...DEFAULT_QUERY, search: 'acme', sort: 'number', page: 2 };
    const params = serializeInvoiceQuery(query);
    expect(params.get('q')).toBe('acme');
    expect(params.get('sort')).toBe('number');
    expect(params.get('page')).toBe('2');
    expect(params.has('dir')).toBe(false);
    expect(params.has('size')).toBe(false);
  });

  it('encodes awkward search text', () => {
    const params = serializeInvoiceQuery({ ...DEFAULT_QUERY, search: 'a&b=c #1' });
    expect(new URLSearchParams(params.toString()).get('q')).toBe('a&b=c #1');
  });

  it('round-trips a fully populated query', () => {
    const query: InvoiceQuery = {
      search: 'ord 7',
      from: '2024-01-05',
      to: '2024-02-10',
      min: '5.25',
      max: '100',
      sort: 'total',
      dir: 'asc',
      page: 4,
      pageSize: 100,
    };
    expect(parseInvoiceQuery(serializeInvoiceQuery(query))).toEqual(query);
  });

  it('round-trips the defaults', () => {
    expect(parseInvoiceQuery(serializeInvoiceQuery(DEFAULT_QUERY))).toEqual(DEFAULT_QUERY);
  });
});

describe('isAmountText', () => {
  it('accepts whole, partly typed and complete amounts', () => {
    for (const value of ['0', '12', '12.', '12.5', '12.50']) expect(isAmountText(value)).toBe(true);
  });

  it('rejects everything else', () => {
    for (const value of ['', '.5', '-1', '1.234', '1,5', 'ten', '1 2', '1234567890123']) {
      expect(isAmountText(value)).toBe(false);
    }
  });
});
