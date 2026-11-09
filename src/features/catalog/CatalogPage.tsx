import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Spinner } from '../../components/Spinner';
import { listProducts } from '../../lib/api/endpoints';
import { useAsync } from '../../lib/useAsync';
import { ProductCard } from './ProductCard';

export function CatalogPage() {
  const products = useAsync(() => listProducts(), []);

  return (
    <section>
      <h1>Catalog</h1>
      <p className="muted">Prices are per kilogram for your organization.</p>

      {products.error && !products.data && (
        <ErrorBanner error={products.error} onRetry={products.reload} />
      )}
      {products.loading && !products.data && <Spinner label="Loading products…" />}
      {products.data && products.data.length === 0 && (
        <EmptyState title="No products available">Check back later.</EmptyState>
      )}
      {products.data && products.data.length > 0 && (
        <div className="product-grid">
          {products.data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
