import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../../services/api';
import DashboardShell from '../../layouts/DashboardShell';
import { ErrorAlert, Loading } from '../../components/StatCard';
import { formatDate, roleLabel } from '../../services/format';

/** Admin-only: every account, with the ability to suspend or reactivate it. */
export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load users.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleStatus(user) {
    const next = user.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/admin/users/${user.id}/status`, { status: next });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update that user.'));
    }
  }

  return (
    <DashboardShell title="Users" subtitle="Every account in the system.">
      <ErrorAlert message={error} onDismiss={() => setError('')} />
      {loading ? <Loading /> : null}

      {!loading ? (
        <div className="card shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Bikes</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="fw-semibold">{user.full_name}</td>
                      <td className="text-muted">{user.email}</td>
                      <td>
                        <span className="badge text-bg-light text-dark">{roleLabel(user.role)}</span>
                      </td>
                      <td className="text-end">{user.rider_count}</td>
                      <td>
                        <span
                          className={`badge text-bg-${user.status === 'active' ? 'success' : 'secondary'}`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="text-muted small">{formatDate(user.created_at)}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className={`btn btn-sm btn-outline-${user.status === 'active' ? 'danger' : 'success'}`}
                          onClick={() => toggleStatus(user)}
                        >
                          {user.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
