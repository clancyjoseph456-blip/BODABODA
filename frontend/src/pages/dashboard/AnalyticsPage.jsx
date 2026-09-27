import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../../services/api';
import DashboardShell from '../../layouts/DashboardShell';
import { ErrorAlert, Loading, MoneyStat, StatCard } from '../../components/StatCard';
import { formatMoney, formatNumber, formatProfit, seasonTone } from '../../services/format';

/** Season performance, profit ranking and break-even distance. */
export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [overview, riders, seasons, breakEven] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/riders'),
          api.get('/analytics/seasons'),
          api.get('/analytics/break-even')
        ]);
        if (!cancelled) {
          setData({
            overview: overview.data,
            riders: riders.data,
            seasons: seasons.data,
            breakEven: breakEven.data
          });
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load analytics.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const busiestSeason = data
    ? data.seasons.reduce((best, s) => (s.revenue > (best?.revenue ?? -1) ? s : best), null)
    : null;

  return (
    <DashboardShell title="Analytics" subtitle="Where the money comes from, and where it goes.">
      {loading ? <Loading label="Building the report…" /> : null}
      <ErrorAlert message={error} onDismiss={() => setError('')} />

      {data ? (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <MoneyStat
                label="Average fare per trip"
                value={data.overview.avg_fare_per_trip}
                sub={`${formatNumber(data.overview.trip_count)} trips recorded`}
              />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard
                label="Fuel per km"
                value={formatMoney(data.overview.fuel_cost_per_km)}
                sub="Cost of moving one km"
              />
            </div>
            <div className="col-6 col-lg-3">
              <MoneyStat
                label="Distance covered"
                value={`${formatNumber(data.overview.total_distance_km)} km`}
                sub={`across ${formatNumber(data.overview.rider_count)} bikes`}
              />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard
                label="Fleet net profit"
                value={formatProfit(data.overview.net_profit)}
                tone={data.overview.net_profit >= 0 ? 'positive' : 'negative'}
                sub={busiestSeason ? `Best season: ${busiestSeason.label}` : ''}
              />
            </div>
          </div>

          <div className="row g-3">
            <div className="col-lg-7">
              <div className="card shadow-sm mb-3">
                <div className="card-header bg-white">
                  <h2 className="h6 mb-0">Profit by rider</h2>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Rider</th>
                          <th className="text-end">Km</th>
                          <th className="text-end">Revenue</th>
                          <th className="text-end">Fuel</th>
                          <th className="text-end">Other</th>
                          <th className="text-end">Net</th>
                          <th className="text-end">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.riders.map((rider) => (
                          <tr key={rider.id}>
                            <td>
                              <div className="fw-semibold">{rider.rider_name}</div>
                              <div className="text-muted small">
                                {rider.bike_model} · {rider.registration_number}
                              </div>
                            </td>
                            <td className="text-end">{formatNumber(rider.distance_km)}</td>
                            <td className="text-end">{formatMoney(rider.revenue)}</td>
                            <td className="text-end text-danger">{formatMoney(rider.fuel_cost)}</td>
                            <td className="text-end text-danger">{formatMoney(rider.other_expenses)}</td>
                            <td
                              className={`text-end fw-semibold ${
                                rider.net_profit >= 0 ? 'text-success' : 'text-danger'
                              }`}
                            >
                              {formatProfit(rider.net_profit)}
                            </td>
                            <td className="text-end text-muted">{rider.margin_pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card shadow-sm mb-3">
                <div className="card-header bg-white">
                  <h2 className="h6 mb-0">Season comparison</h2>
                </div>
                <div className="card-body">
                  {data.seasons.map((season) => {
                    const share =
                      data.overview.total_revenue > 0
                        ? (season.revenue / data.overview.total_revenue) * 100
                        : 0;
                    return (
                      <div key={season.season} className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span>
                            <span className={`badge text-bg-${seasonTone(season.season)} me-2`}>
                              {season.label}
                            </span>
                            <span className="text-muted small">
                              ×{season.fare_multiplier} fare
                              {season.fuel_multiplier !== 1 ? ` · ×${season.fuel_multiplier} fuel` : ''}
                            </span>
                          </span>
                          <span className="fw-semibold small">{formatMoney(season.revenue)}</span>
                        </div>
                        <div className="progress" style={{ height: 6 }}>
                          <div
                            className="progress-bar bg-primary"
                            style={{ width: `${Math.min(100, share)}%` }}
                            role="progressbar"
                            aria-valuenow={Math.round(share)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                        <div className="text-muted small mt-1">
                          {formatNumber(season.trip_count)} trips · {formatNumber(season.distance_km)} km
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card shadow-sm">
                <div className="card-header bg-white">
                  <h2 className="h6 mb-0">Break-even distance</h2>
                </div>
                <div className="card-body">
                  <p className="text-muted small">
                    How far each bike must ride before fuel costs cancel out the fare income.
                  </p>
                  {data.breakEven.map((item) => (
                    <div
                      key={item.id}
                      className="d-flex justify-content-between align-items-center py-2 border-bottom"
                    >
                      <span>{item.bike_model}</span>
                      <span className="fw-semibold">
                        {item.break_even_km === null
                          ? 'Never (loss per km)'
                          : `${formatNumber(item.break_even_km)} km`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </DashboardShell>
  );
}
