import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { returnToFromState } from '../../app/returnTo';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Spinner } from '../../components/Spinner';
import { asApiError } from '../../lib/api/client';
import type { ApiError } from '../../lib/api/client';
import { useAuth } from './AuthProvider';

export function SelectOrganizationPage() {
  const auth = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  if (auth.status === 'loading') return <Spinner />;
  if (auth.status === 'signed_out') return <Navigate to="/sign-in" replace />;
  if (auth.status === 'ready') return <Navigate to={returnToFromState(location.state)} replace />;

  async function choose(organizationId: string) {
    setPending(organizationId);
    setError(null);
    try {
      await auth.selectOrganization(organizationId);
    } catch (e) {
      setError(asApiError(e));
      setPending(null);
    }
  }

  return (
    <main className="auth-page">
      <div className="card auth-card">
        <h1>Choose an organization</h1>
        {error && <ErrorBanner error={error} />}
        {auth.memberships.length === 0 ? (
          <EmptyState title="No organizations">
            This account is not a member of any organization.
          </EmptyState>
        ) : (
          <ul className="plain-list">
            {auth.memberships.map((m) => (
              <li key={m.organization_id}>
                <Button
                  variant="secondary"
                  className="btn-block"
                  loading={pending === m.organization_id}
                  disabled={pending !== null}
                  onClick={() => choose(m.organization_id)}
                >
                  {m.organization_name} ({m.role})
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" onClick={() => auth.signOut()}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
