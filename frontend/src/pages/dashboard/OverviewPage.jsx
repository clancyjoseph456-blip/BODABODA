import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DashboardShell from '../../layouts/DashboardShell';
import { MoneyStat, StatCard, EmptyState, Loading } from '../../components/StatCard';
import { formatMoney, formatNumber, formatProfit } from '../../services/format';

/** Admin and owner land here. Riders get a simplified personal view. */
export default function OverviewPage() {
  const { user, isRider } = useAuth();
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((s) => ({ ...s, loading: true, error: '' }));
      try {
        const [overview, riders] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/riders')
        ]);
        if (!cancelled) {
          setState({ loading: false, error: '', data: { overview: overview.data, riders: riders.data } });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ loading: false, error: error.message || 'Could not load your dashboard.', data: null });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { loading, error, data } = state;

  return (
    <DashboardShell
      title={isRider ? `Hello, ${user?.full_name?.split(' ')[0] || 'rider'}` : 'Fleet Overview'}
      subtitle={isRider ? 'Your earnings and running costs at a glance.' : 'Live profit across every bike you manage.'}
    >
      {loading ? <Loading label="Crunching the numbers…" /> : null}

      {!loading && error ? (
        <div className="alert alert-danger">{error}</div>
      ) : null}

      {!loading && data ? (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <MoneyStat
                label="Total revenue"
                value={data.overview.total_revenue}
                sub={`${formatNumber(data.overview.trip_count)} trips`}
              />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard
                label="Net profit"
                value={formatProfit(data.overview.net_profit)}
                tone={data.overview.net_profit >= 0 ? 'positive' : 'negative'}
                sub={`Margin on ${formatMoney(data.overview.total_revenue)} revenue`}
              />
            </div>
            <div className="col-6 col-lg-3">
              <MoneyStat
                label="Total expenses"
                value={data.overview.total_expenses}
                sub={`${formatMoney(data.overview.total_fuel_cost)} fuel`}
              />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard
                label="Distance covered"
                value={`${formatNumber(data.overview.total_distance_km)} km`}
                sub={`${formatMoney(data.overview.fuel_cost_per_km)} fuel per km`}
              />
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <h2 className="h6 mb-0">
                {isRider ? 'Your bikes' : 'Riders ranked by profit'}
              </h2>
              <Link to="/app/riders" className="btn btn-sm btn-outline-primary">
                Manage
              </Link>
            </div>
            <div className="card-body p-0">
              {data.riders.length === 0 ? (
                <EmptyState title="No bikes yet">
                  {isRider
                    ? 'An admin needs to assign a bike to your account.'
                    : 'Add your first rider to start tracking trips.'}
                </EmptyState>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Rider</th>
                        <th>Bike</th>
                        <th className="text-end">Trips</th>
                        <th className="text-end">Revenue</th>
                        <th className="text-end">Expenses</th>
                        <th className="text-end">Net profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.riders.map((rider) => (
                        <tr key={rider.id}>
                          <td>
                            <Link to={`/app/riders/${rider.id}`} className="fw-semibold">
                              {rider.owner?.full_name || `Rider #${rider.id}`}
                            </Link>
                            <div className="text-muted small">{rider.registration_number}</div>
                          </td>
                          <td className="text-muted">{rider.bike_model}</td>
                          <td className="text-end">{formatNumber(rider.trip_count)}</td>
                          <td className="text-end">{formatMoney(rider.total_revenue)}</td>
                          <td className="text-end">{formatMoney(rider.total_expenses)}</td>
                          <td
                            className={`text-end fw-semibold ${
                              rider.net_profit >= 0 ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {formatProfit(rider.net_profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </DashboardShell>
  );
}
