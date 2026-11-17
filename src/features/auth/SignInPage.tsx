import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Spinner } from '../../components/Spinner';
import { asApiError } from '../../lib/api/client';
import type { ApiError } from '../../lib/api/client';
import { useAuth } from './AuthProvider';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LAST_USER_KEY = 'carrot_last_user';

interface FieldErrors {
  email?: string;
  password?: string;
}

interface LastUser {
  name: string;
  email: string;
}

export function validateSignIn(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Enter your email address.';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

/** Reads the greeting left by the last successful sign-in; absent or malformed is just "no greeting". */
export function readLastUser(): LastUser | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { name, email } = parsed as Record<string, unknown>;
    if (typeof name !== 'string' || typeof email !== 'string') return null;
    return { name, email };
  } catch {
    return null;
  }
}

export function clearLastUser(): void {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

export function SignInPage() {
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/catalog';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastUser, setLastUser] = useState<LastUser | null>(() => readLastUser());

  if (auth.status === 'loading') return <Spinner />;
  if (auth.status === 'ready') return <Navigate to={from} replace />;
  if (auth.status === 'needs_org') return <Navigate to="/select-organization" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const errors = validateSignIn(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    setError(null);
    try {
      await auth.signIn(email.trim(), password);
    } catch (e) {
      setError(asApiError(e));
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="card auth-card" onSubmit={onSubmit} noValidate>
        <h1>Carrot Cart</h1>
        {lastUser ? (
          <p className="muted">
            Welcome back, {lastUser.name} — sign in to continue.{' '}
            <button
              type="button"
              onClick={() => {
                clearLastUser();
                setLastUser(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              not you? clear
            </button>
          </p>
        ) : (
          <p className="muted">Sign in to order wholesale carrots.</p>
        )}

        {auth.sessionExpired && (
          <div className="banner banner-warning" role="status">
            Your session has expired. Please sign in again; your cart has been kept.
          </div>
        )}
        {error &&
          (error.code === 'invalid_credentials' ? (
            <ErrorBanner error="Incorrect email or password." />
          ) : (
            <ErrorBanner error={error} />
          ))}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={fieldErrors.email ? true : undefined}
          />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={fieldErrors.password ? true : undefined}
          />
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </label>

        <Button type="submit" loading={submitting}>
          Sign in
        </Button>
      </form>
    </main>
  );
}
