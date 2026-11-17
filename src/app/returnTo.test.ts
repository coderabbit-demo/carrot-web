import { describe, expect, it } from 'vitest';
import { DEFAULT_RETURN_TO, locationToReturnTo, returnToFromState, sanitizeReturnTo } from './returnTo';

describe('sanitizeReturnTo', () => {
  it('keeps same-app paths with query and hash', () => {
    expect(sanitizeReturnTo('/orders')).toBe('/orders');
    expect(sanitizeReturnTo('/orders?status=confirmed&q=1042')).toBe('/orders?status=confirmed&q=1042');
    expect(sanitizeReturnTo('/catalog?q=orange#top')).toBe('/catalog?q=orange#top');
    expect(sanitizeReturnTo('/')).toBe('/');
  });

  it('rejects protocol-relative and absolute URLs', () => {
    expect(sanitizeReturnTo('//evil.example/path')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('https://evil.example/')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('http://evil.example')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('javascript:alert(1)')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('orders')).toBe(DEFAULT_RETURN_TO);
  });

  it('rejects backslashes and control characters', () => {
    expect(sanitizeReturnTo('/\\evil.example')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('/orders\\..\\x')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('/\t/evil.example')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('/orders\nSet-Cookie: a=b')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('/orders\u0000')).toBe(DEFAULT_RETURN_TO);
  });

  it('never returns to the sign-in pages', () => {
    expect(sanitizeReturnTo('/sign-in')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('/sign-in?next=/orders')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('/select-organization')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('/Select-Organization/')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('/sign-in#x')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('/%73ign-in')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('/orders/../sign-in')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo('/orders/%E0%A4%A')).toBe(DEFAULT_RETURN_TO);
  });

  it('falls back for empty and non-string values', () => {
    expect(sanitizeReturnTo('')).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo(undefined)).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo(null)).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo(42)).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo({ pathname: '/orders' })).toBe(DEFAULT_RETURN_TO);
  });
});

describe('locationToReturnTo', () => {
  it('joins pathname, search and hash', () => {
    expect(locationToReturnTo({ pathname: '/orders', search: '?status=confirmed', hash: '#row-3' })).toBe(
      '/orders?status=confirmed#row-3',
    );
  });

  it('falls back when the location is a sign-in page', () => {
    expect(locationToReturnTo({ pathname: '/sign-in', search: '', hash: '' })).toBe(DEFAULT_RETURN_TO);
  });
});

describe('returnToFromState', () => {
  it('reads a valid from value', () => {
    expect(returnToFromState({ from: '/invoices?sort=date' })).toBe('/invoices?sort=date');
  });

  it('ignores missing or malformed router state', () => {
    expect(returnToFromState(null)).toBe(DEFAULT_RETURN_TO);
    expect(returnToFromState(undefined)).toBe(DEFAULT_RETURN_TO);
    expect(returnToFromState('/orders')).toBe(DEFAULT_RETURN_TO);
    expect(returnToFromState({ from: 7 })).toBe(DEFAULT_RETURN_TO);
    expect(returnToFromState({ from: '//evil.example' })).toBe(DEFAULT_RETURN_TO);
  });
});
