import type { ReactNode } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Spinner } from '../../components/Spinner';
import type { ApiError } from '../../lib/api/client';

interface Props {
  title: string;
  loadingLabel: string;
  loading: boolean;
  error: ApiError | null;
  /** True once there is something to render; a failed reload then shows the error above it. */
  hasData: boolean;
  onRetry: () => void;
  children: ReactNode;
}

/** A titled block that handles its own loading and error state, so sections fail independently. */
export function AsyncSection({ title, loadingLabel, loading, error, hasData, onRetry, children }: Props) {
  return (
    <section className="overview-section" aria-label={title}>
      <h2>{title}</h2>
      {error && <ErrorBanner error={error} onRetry={onRetry} />}
      {loading && !hasData && <Spinner label={loadingLabel} />}
      {hasData && children}
    </section>
  );
}
