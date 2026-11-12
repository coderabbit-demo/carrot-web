export const DEFAULT_RETURN_TO = '/catalog';

const AUTH_PATHS = ['/sign-in', '/select-organization'];
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const PROBE_ORIGIN = 'http://app.invalid';

// The router matches on the decoded pathname, so "/%73ign-in" must count as the sign-in page.
function isAuthPath(pathname: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  const normalized = decoded.toLowerCase().replace(/\/+$/, '');
  return AUTH_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`));
}

/**
 * Accepts only a same-app relative location (single leading slash). Anything that could
 * leave the origin, or lead back into the sign-in flow, falls back to the catalog.
 */
export function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value === '') return DEFAULT_RETURN_TO;
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_RETURN_TO;
  if (value.includes('\\') || CONTROL_CHARS.test(value)) return DEFAULT_RETURN_TO;

  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return DEFAULT_RETURN_TO;
  }
  if (url.origin !== PROBE_ORIGIN) return DEFAULT_RETURN_TO;
  if (isAuthPath(url.pathname)) return DEFAULT_RETURN_TO;
  return value;
}

export function locationToReturnTo(location: { pathname: string; search: string; hash: string }): string {
  return sanitizeReturnTo(`${location.pathname}${location.search}${location.hash}`);
}

/** Reads the `from` value stored in router state; any other shape yields the default. */
export function returnToFromState(state: unknown): string {
  if (typeof state !== 'object' || state === null) return DEFAULT_RETURN_TO;
  return sanitizeReturnTo((state as { from?: unknown }).from);
}
