import { useAuth } from '../auth/AuthProvider';

export function AccountPage() {
  const { user, organization, memberships } = useAuth();
  if (!user || !organization) return null;

  return (
    <section>
      <h1>Account</h1>

      <div className="card">
        <dl className="details">
          <dt>Name</dt>
          <dd>{user.name}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Organization</dt>
          <dd>{organization.name}</dd>
          <dt>Role</dt>
          <dd>{organization.role === 'admin' ? 'Administrator' : 'Buyer'}</dd>
        </dl>
      </div>

      <h2>Memberships</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => (
              <tr key={m.organization_id}>
                <td>{m.organization_name}</td>
                <td>{m.role}</td>
                <td>{m.organization_id === organization.id ? 'Current' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
