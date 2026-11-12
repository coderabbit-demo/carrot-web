import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, decodeErrorBody, isRetryable, request, userMessage } from './client';

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

describe('unreadable success bodies', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(response: Response) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  }

  it('rejects a 200 with an HTML body as unexpected_response', async () => {
    stubFetch(
      new Response('<html>Welcome</html>', {
        status: 200,
        headers: { 'X-Carrot-Request-Id': 'req-7' },
      }),
    );
    const error = await request('GET', '/products').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.code).toBe('unexpected_response');
    expect(apiError.status).toBe(200);
    expect(apiError.requestId).toBe('req-7');
    expect(userMessage(apiError)).toBe('Unexpected response from the server (HTTP 200).');
    expect(isRetryable(apiError)).toBe(true);
  });

  it('still returns valid JSON and 204 responses', async () => {
    stubFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect((await request<{ ok: boolean }>('GET', '/ok')).data).toEqual({ ok: true });

    stubFetch(new Response(null, { status: 204 }));
    const empty = await request('GET', '/empty');
    expect(empty.status).toBe(204);
    expect(empty.data).toBeUndefined();
  });

  it('treats 205 like 204 for endpoints without a body', async () => {
    stubFetch(new Response(null, { status: 205 }));
    const empty = await request('GET', '/empty').catch((e: unknown) => e);
    expect(empty).not.toBeInstanceOf(Error);
    expect((empty as { status: number }).status).toBe(205);
  });

  it('rejects an empty 200 body as unexpected_response', async () => {
    stubFetch(new Response('', { status: 200 }));
    const error = await request('GET', '/products').catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('unexpected_response');
  });

  it('returns a blob body without parsing it as JSON', async () => {
    stubFetch(new Response('%PDF-1.4', { status: 200 }));
    const res = await request<Blob>('GET', '/file', { responseType: 'blob' });
    expect(await res.data.text()).toBe('%PDF-1.4');
  });

  it('only treats unexpected_response as retryable for 2xx and 3xx', () => {
    const make = (status: number) =>
      new ApiError({ code: 'unexpected_response', message: 'x', status });
    expect(isRetryable(make(200))).toBe(true);
    expect(isRetryable(make(302))).toBe(true);
    expect(isRetryable(make(400))).toBe(false);
    expect(isRetryable(make(404))).toBe(false);
    expect(isRetryable(make(502))).toBe(true);
  });
});
