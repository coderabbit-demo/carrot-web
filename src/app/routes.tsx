import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { AccountPage } from '../features/account/AccountPage';
import { SelectOrganizationPage } from '../features/auth/SelectOrganizationPage';
import { SignInPage } from '../features/auth/SignInPage';
import { CartPage } from '../features/cart/CartPage';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { CheckoutWizard } from '../features/checkout/CheckoutWizard';
import { InvoicesPage } from '../features/invoices/InvoicesPage';
import { OrderDetailPage } from '../features/orders/OrderDetailPage';
import { OrdersPage } from '../features/orders/OrdersPage';
import { Layout } from './Layout';
import { ProtectedRoute } from './ProtectedRoute';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/select-organization" element={<SelectOrganizationPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/catalog" replace />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/checkout" element={<CheckoutWizard />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route
            path="*"
            element={
              <EmptyState title="Page not found">
                <Link to="/catalog">Go to the catalog</Link>
              </EmptyState>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
