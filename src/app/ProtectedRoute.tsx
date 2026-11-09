import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../features/auth/AuthProvider';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Spinner />;
  if (status === 'signed_out') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  if (status === 'needs_org') return <Navigate to="/select-organization" replace />;
  return <Outlet />;
}
