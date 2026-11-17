import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '../components/Button';
import { useAuth } from '../features/auth/AuthProvider';
import { useCart } from '../features/cart/CartProvider';

export function Layout() {
  const { user, organization, signOut } = useAuth();
  const { itemCount } = useCart();

  return (
    <div className="shell">
      <header className="site-header">
        <div className="site-header-inner">
          <span className="brand">Carrot Cart</span>
          <nav aria-label="Main">
            <NavLink to="/catalog">Catalog</NavLink>
            <NavLink to="/cart">Cart{itemCount > 0 ? ` (${itemCount})` : ''}</NavLink>
            <NavLink to="/orders">Orders</NavLink>
            <NavLink to="/invoices">Invoices</NavLink>
            {organization?.role === 'admin' && <NavLink to="/organization">Organization</NavLink>}
            <NavLink to="/account">Account</NavLink>
          </nav>
          <div className="who">
            <span>
              <strong>{organization?.name}</strong>
              {user && <span className="muted"> · {user.name}</span>}
            </span>
            <Button variant="secondary" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
