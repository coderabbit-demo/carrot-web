import type { Membership } from '../../lib/api/types';
import { summarizeMemberships } from './overviewStats';

interface Props {
  memberships: Membership[];
  currentOrganizationId: string;
}

function roleLabel(role: Membership['role']): string {
  return role === 'admin' ? 'Administrator' : 'Buyer';
}

export function MembershipSummary({ memberships, currentOrganizationId }: Props) {
  const summary = summarizeMemberships(memberships, currentOrganizationId);

  return (
    <>
      <dl className="overview-cards" aria-label="Memberships">
        <div className="overview-card">
          <dt>Organizations you belong to</dt>
          <dd className="overview-figure">{summary.total}</dd>
        </div>
        <div className="overview-card">
          <dt>As administrator</dt>
          <dd className="overview-figure">{summary.adminCount}</dd>
        </div>
        <div className="overview-card">
          <dt>As buyer</dt>
          <dd className="overview-figure">{summary.buyerCount}</dd>
        </div>
      </dl>

      {summary.current && (
        <p>
          You are working in <strong>{summary.current.organization_name}</strong> as{' '}
          {roleLabel(summary.current.role).toLowerCase()}.
        </p>
      )}

      {summary.others.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="overview-caption">Your other organizations</caption>
            <thead>
              <tr>
                <th scope="col">Organization</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {summary.others.map((m) => (
                <tr key={m.organization_id}>
                  <td>{m.organization_name}</td>
                  <td>{roleLabel(m.role)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
