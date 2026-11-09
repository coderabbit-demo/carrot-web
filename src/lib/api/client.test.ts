import { describe, expect, it } from 'vitest';
import { ApiError, decodeErrorBody, isRetryable, userMessage } from './client';

describe('decodeErrorBody', () => {
  it('decodes the contract error envelope', () => {
    const body = JSON.stringify({
      error: {
        code: 'insufficient_stock',
        message: 'not enough stock',
        request_id: 'req-1',
        details: { items: [{ product_id: 'p', requested_kg: 10, available_kg: 4 }] },
      },
    });
    const error = decodeErrorBody(409, body, null);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('insufficient_stock');
    expect(error.status).toBe(409);
    expect(error.requestId).toBe('req-1');
    expect(error.details?.items).toHaveLength(1);
  });

  it('falls back to the response header for the request id', () => {
    const body = JSON.stringify({ error: { code: 'not_found', message: 'missing' } });
    expect(decodeErrorBody(404, body, 'hdr-9').requestId).toBe('hdr-9');
  });

  it('handles bodies that are not envelopes', () => {
    const html = decodeErrorBody(502, '<html>bad gateway</html>', null);
    expect(html.code).toBe('unexpected_response');
    expect(html.status).toBe(502);

    const wrongShape = decodeErrorBody(400, JSON.stringify({ error: 'nope' }), null);
    expect(wrongShape.code).toBe('unexpected_response');
  });
});

describe('error helpers', () => {
  it('treats transport and 5xx errors as retryable', () => {
    expect(isRetryable(new ApiError({ code: 'network_error', message: 'x', status: 0 }))).toBe(true);
    expect(isRetryable(new ApiError({ code: 'upstream_timeout', message: 'x', status: 504 }))).toBe(true);
    expect(isRetryable(new ApiError({ code: 'validation_failed', message: 'x', status: 400 }))).toBe(false);
  });

  it('does not show server wording for 5xx', () => {
    const error = new ApiError({ code: 'internal_error', message: 'db exploded', status: 500 });
    expect(userMessage(error)).not.toContain('db exploded');
  });
});
