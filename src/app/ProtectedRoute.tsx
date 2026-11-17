import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../features/auth/AuthProvider';
import { locationToReturnTo } from './returnTo';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Spinner />;
  if (status === 'signed_out') {
    return <Navigate to="/sign-in" replace state={{ from: locationToReturnTo(location) }} />;
  }
  if (status === 'needs_org') {
    return <Navigate to="/select-organization" replace state={{ from: locationToReturnTo(location) }} />;
  }
  return <Outlet />;
}
