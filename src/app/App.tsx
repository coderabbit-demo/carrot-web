import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { CartProvider } from '../features/cart/CartProvider';
import { AppRoutes } from './routes';

function OrganizationCart({ children }: { children: ReactNode }) {
  const { organization } = useAuth();
  const id = organization?.id ?? null;
  // Remount per organization so each one loads its own saved cart.
  return (
    <CartProvider key={id ?? 'none'} organizationId={id}>
      {children}
    </CartProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <OrganizationCart>
        <AppRoutes />
      </OrganizationCart>
    </AuthProvider>
  );
}
