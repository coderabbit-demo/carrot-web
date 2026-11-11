import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { listInvoices, listOrders } from '../../lib/api/endpoints';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../auth/AuthProvider';
import { AsyncSection } from './AsyncSection';
import { AttentionList } from './AttentionList';
import { MembershipSummary } from './MembershipSummary';
import { InvoiceSummaryCards, OrderSummaryCards } from './SummaryCards';
import { summarizeInvoices, summarizeOrders } from './overviewStats';
import './organization.css';

// How many of the most recent records each list asks for. The page says when a list hits this.
const RECORD_LIMIT = 100;

export function OrganizationPage() {
  const { organization } = useAuth();
  if (!organization) return null;

  if (organization.role !== 'admin') {
    return (
      <section>
        <h1>Organization</h1>
        <EmptyState title="You do not have access to this page">
          <p>
            The organization overview is for administrators of {organization.name}. Ask an
            administrator if you need these figures.
          </p>
          <p>
            <Link to="/orders">Go to your orders</Link>
          </p>
        </EmptyState>
      </section>
    );
  }

  return <Overview />;
}

function Overview() {
  const { organization, memberships } = useAuth();
  const orders = useAsync(() => listOrders(RECORD_LIMIT), []);
  const invoices = useAsync(() => listInvoices(RECORD_LIMIT), []);

  // Only reached for an admin of a selected organization, see OrganizationPage.
  if (!organization) return null;

  const orderSummary = orders.data ? summarizeOrders(orders.data) : null;
  const invoiceSummary = invoices.data ? summarizeInvoices(invoices.data) : null;
  const refreshing = orders.loading || invoices.loading;

  function refresh() {
    orders.reload();
    invoices.reload();
  }

  return (
    <section className="overview">
      <div className="overview-head">
        <div>
          <h1>Organization</h1>
          <p className="muted">{organization.name}</p>
        </div>
        <Button variant="secondary" loading={refreshing} onClick={refresh}>
          Refresh
        </Button>
      </div>

      <AsyncSection
        title="Needs attention"
        loadingLabel="Loading orders…"
        loading={orders.loading}
        error={orders.error}
        hasData={orderSummary !== null}
        onRetry={orders.reload}
      >
        {orderSummary && <AttentionList orders={orderSummary.attention} />}
      </AsyncSection>

      <AsyncSection
        title="Orders"
        loadingLabel="Loading orders…"
        loading={orders.loading}
        error={orders.error}
        hasData={orderSummary !== null}
        onRetry={orders.reload}
      >
        {orderSummary &&
          (orderSummary.orderCount === 0 ? (
            <EmptyState title="No orders yet">Orders placed by your team will be summarized here.</EmptyState>
          ) : (
            <OrderSummaryCards summary={orderSummary} limit={RECORD_LIMIT} />
          ))}
      </AsyncSection>

      <AsyncSection
        title="Invoices"
        loadingLabel="Loading invoices…"
        loading={invoices.loading}
        error={invoices.error}
        hasData={invoiceSummary !== null}
        onRetry={invoices.reload}
      >
        {invoiceSummary &&
          (invoiceSummary.invoiceCount === 0 ? (
            <EmptyState title="No invoices yet">An invoice is issued once an order is paid.</EmptyState>
          ) : (
            <InvoiceSummaryCards summary={invoiceSummary} limit={RECORD_LIMIT} />
          ))}
      </AsyncSection>

      <section className="overview-section" aria-label="Membership">
        <h2>Membership</h2>
        <MembershipSummary memberships={memberships} currentOrganizationId={organization.id} />
      </section>
    </section>
  );
}
