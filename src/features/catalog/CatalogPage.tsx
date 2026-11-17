import { useState } from 'react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Spinner } from '../../components/Spinner';
import { listProducts } from '../../lib/api/endpoints';
import { useAsync } from '../../lib/useAsync';
import { filterProducts } from './catalogFilter';
import { ProductCard } from './ProductCard';

export function CatalogPage() {
  const products = useAsync(() => listProducts(), []);
  const [query, setQuery] = useState('');
  const visible = products.data ? filterProducts(products.data, query) : [];

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
        <>
          <label className="field search-field">
            <span>Search products</span>
            <input
              type="search"
              placeholder="Name or SKU"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {visible.length === 0 ? (
            <EmptyState title="No products match your search">
              <Button variant="secondary" onClick={() => setQuery('')}>
                Clear search
              </Button>
            </EmptyState>
          ) : (
            <div className="product-grid">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
