import type { ErrorEnvelope } from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;
  readonly requestId: string | undefined;

  constructor(init: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
    requestId?: string;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.details = init.details;
    this.requestId = init.requestId;
  }
}

function isEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const inner = (value as { error?: unknown }).error;
  if (typeof inner !== 'object' || inner === null) return false;
  const { code, message } = inner as { code?: unknown; message?: unknown };
  return typeof code === 'string' && typeof message === 'string';
}

/** Decodes the contract error envelope; anything else becomes `unexpected_response`. */
export function decodeErrorBody(
  status: number,
  bodyText: string,
  requestIdHeader: string | null,
): ApiError {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = null;
  }
  if (isEnvelope(parsed)) {
    const { code, message, request_id, details } = parsed.error;
    return new ApiError({
      code,
      message,
      status,
      details: typeof details === 'object' && details !== null ? details : undefined,
      requestId: request_id ?? requestIdHeader ?? undefined,
    });
  }
  return new ApiError({
    code: 'unexpected_response',
    message: `Unexpected response from the server (HTTP ${status}).`,
    status,
    requestId: requestIdHeader ?? undefined,
  });
}

export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError({ code: 'unknown_error', message: 'Something went wrong.', status: 0 });
}

/** True for transport failures and server-side errors, where trying again may help. */
export function isRetryable(error: ApiError): boolean {
  return error.status === 0 || error.status >= 500;
}

/** Text safe to show a user. */
export function userMessage(error: ApiError): string {
  if (error.status === 0) return 'Could not reach the server. Check your connection and try again.';
  if (error.status >= 500) return 'The service is having trouble right now. Please try again in a moment.';
  return error.message;
}

let csrfToken: string | null = null;
let csrfInFlight: Promise<string> | null = null;
let organizationId: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setOrganizationId(id: string | null): void {
  organizationId = id;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/** Called once for every 401 `unauthenticated` response (except calls made with ignoreUnauthorized). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function resetClientState(): void {
  csrfToken = null;
  csrfInFlight = null;
  organizationId = null;
}

export interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  responseType?: 'json' | 'blob';
  /** For probes such as the initial /me call, where a 401 just means "signed out". */
  ignoreUnauthorized?: boolean;
  /** Lets a caller bound how long it waits for this particular request. */
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  status: number;
  data: T;
  headers: Headers;
}

// The CSRF token is fetched lazily, on the first state-changing call. The gateway uses a
// double-submit cookie, so the token we send must match the carrot_csrf cookie it set.
async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfInFlight) {
    csrfInFlight = request<{ csrf_token: string }>('GET', '/auth/csrf')
      .then((res) => {
        csrfToken = res.data.csrf_token;
        return csrfToken;
      })
      .finally(() => {
        csrfInFlight = null;
      });
  }
  return csrfInFlight;
}

async function attempt(method: string, path: string, options: RequestOptions): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Accept', options.responseType === 'blob' ? '*/*' : 'application/json');
  if (organizationId) headers.set('X-Organization-Id', organizationId);
  if (method !== 'GET') headers.set('X-CSRF-Token', await getCsrfToken());

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body,
      credentials: 'include',
      signal: options.signal,
    });
  } catch {
    throw new ApiError({
      code: 'network_error',
      message: 'Could not reach the server.',
      status: 0,
    });
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => '');
  return decodeErrorBody(res.status, text, res.headers.get('X-Carrot-Request-Id'));
}

export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  for (let tries = 0; ; tries++) {
    const res = await attempt(method, path, options);

    if (res.ok) {
      if (res.status === 204) return { status: 204, data: undefined as T, headers: res.headers };
      const data = options.responseType === 'blob' ? await res.blob() : await res.json();
      return { status: res.status, data: data as T, headers: res.headers };
    }

    const error = await toApiError(res);
    // A stale CSRF token (cookie rotated or expired): fetch a fresh one and retry once.
    // The Idempotency-Key header, if any, is unchanged so the retry cannot duplicate an order.
    if (error.code === 'csrf_failed' && method !== 'GET' && tries === 0) {
      csrfToken = null;
      continue;
    }
    if (error.status === 401 && error.code === 'unauthenticated' && !options.ignoreUnauthorized) {
      unauthorizedHandler?.();
    }
    throw error;
  }
}
