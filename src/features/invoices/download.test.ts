import { describe, expect, it } from 'vitest';
import { filenameFromDisposition } from './download';

describe('filenameFromDisposition', () => {
  const fallback = 'invoice-INV-100001.html';

  it('reads a quoted filename', () => {
    expect(filenameFromDisposition('attachment; filename="invoice-INV-100002.html"', fallback)).toBe(
      'invoice-INV-100002.html',
    );
  });

  it('prefers the RFC 5987 form', () => {
    expect(
      filenameFromDisposition(`attachment; filename="x.html"; filename*=UTF-8''invoice%20A.html`, fallback),
    ).toBe('invoice A.html');
  });

  it('falls back when the header is missing or unusable', () => {
    expect(filenameFromDisposition(null, fallback)).toBe(fallback);
    expect(filenameFromDisposition('attachment', fallback)).toBe(fallback);
  });

  it('strips path separators', () => {
    expect(filenameFromDisposition('attachment; filename="../evil.html"', fallback)).toBe('.._evil.html');
  });
});
