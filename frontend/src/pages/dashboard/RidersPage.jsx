import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DashboardShell from '../../layouts/DashboardShell';
import { ErrorAlert, Loading, EmptyState } from '../../components/StatCard';
import { formatMoney, formatNumber, formatProfit } from '../../services/format';

const BLANK = {
  bike_model: '',
  registration_number: '',
  base_fare: '50',
  rate_per_km: '20',
  fuel_price_per_litre: '180',
  fuel_consumption_per_km: '0.03'
};

/** Fleet list. Riders see only their own bike and get no "add" button. */
export default function RidersPage() {
  const { isRider, isOwner, isAdmin } = useAuth();
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/riders');
      setRiders(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load riders.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createRider(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.post('/riders', {
        bike_model: form.bike_model.trim(),
        registration_number: form.registration_number.trim().toUpperCase(),
        base_fare: Number(form.base_fare),
        rate_per_km: Number(form.rate_per_km),
        fuel_price_per_litre: Number(form.fuel_price_per_litre),
        fuel_consumption_per_km: Number(form.fuel_consumption_per_km)
      });
      setForm(BLANK);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not add that rider.'));
    } finally {
      setSaving(false);
    }
  }

  async function removeRider(id) {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Remove this rider and all their trip history?')) return;
    try {
      await api.delete(`/riders/${id}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove that rider.'));
    }
  }

  return (
    <DashboardShell
      title={isRider ? 'My Bike' : 'Riders'}
      subtitle={
        isRider
          ? 'Your bike and its pricing rules.'
          : 'Add bikes, tune their rates, and open a trip log.'
      }
      actions={
        isOwner || isAdmin ? (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? 'Cancel' : '+ Add rider'}
          </button>
        ) : null
      }
    >
      <ErrorAlert message={error} onDismiss={() => setError('')} />

      {showForm ? (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-white">
            <h2 className="h6 mb-0">New rider</h2>
          </div>
          <div className="card-body">
            <ErrorAlert message={formError} onDismiss={() => setFormError('')} />
            <form onSubmit={createRider}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="model">Bike model</label>
                  <input
                    id="model"
                    type="text"
                    required
                    className="form-control"
                    value={form.bike_model}
                    onChange={(e) => setForm({ ...form, bike_model: e.target.value })}
                    placeholder="Bajaj Boxer"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="reg">Registration number</label>
                  <input
                    id="reg"
                    type="text"
                    required
                    className="form-control"
                    value={form.registration_number}
                    onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                    placeholder="KDA 412B"
                  />
                </div>
              </div>

              <p className="text-muted small mt-3 mb-2">
                Pricing rules for this bike. Fare = (base + per km + load surcharge) × season multiplier.
              </p>
              <div className="row g-3">
                <div className="col-6 col-md-3">
                  <label className="form-label small" htmlFor="base">Base fare (KSh)</label>
                  <input id="base" type="number" step="0.01" min="0" required className="form-control form-control-sm"
                    value={form.base_fare} onChange={(e) => setForm({ ...form, base_fare: e.target.value })} />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small" htmlFor="rate">Per km (KSh)</label>
                  <input id="rate" type="number" step="0.01" min="0" required className="form-control form-control-sm"
                    value={form.rate_per_km} onChange={(e) => setForm({ ...form, rate_per_km: e.target.value })} />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small" htmlFor="fuelprice">Fuel price / litre</label>
                  <input id="fuelprice" type="number" step="0.01" min="0" required className="form-control form-control-sm"
                    value={form.fuel_price_per_litre}
                    onChange={(e) => setForm({ ...form, fuel_price_per_litre: e.target.value })} />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small" htmlFor="consumption">Litres / km</label>
                  <input id="consumption" type="number" step="0.001" min="0" required className="form-control form-control-sm"
                    value={form.fuel_consumption_per_km}
                    onChange={(e) => setForm({ ...form, fuel_consumption_per_km: e.target.value })} />
                </div>
              </div>

              <button type="submit" className="btn btn-primary mt-3" disabled={saving}>
                {saving ? 'Saving…' : 'Add rider'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {loading ? <Loading /> : null}

      {!loading && riders.length === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body">
            <EmptyState title="No riders yet">
              {isRider
                ? 'An admin needs to assign a bike to your account before you can log trips.'
                : 'Add your first rider to begin tracking revenue and costs.'}
            </EmptyState>
          </div>
        </div>
      ) : null}

      {!loading && riders.length > 0 ? (
        <div className="card shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Registration</th>
                    <th>Model</th>
                    {!isRider ? <th>Owner</th> : null}
                    <th className="text-end">Base / km</th>
                    <th className="text-end">Trips</th>
                    <th className="text-end">Revenue</th>
                    <th className="text-end">Net profit</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {riders.map((rider) => (
                    <tr key={rider.id}>
                      <td className="fw-semibold">{rider.registration_number}</td>
                      <td className="text-muted">{rider.bike_model}</td>
                      {!isRider ? (
                        <td className="text-muted">{rider.owner?.full_name || '—'}</td>
                      ) : null}
                      <td className="text-end text-muted">
                        {formatMoney(rider.base_fare)} / {formatMoney(rider.rate_per_km)}
                      </td>
                      <td className="text-end">{formatNumber(rider.trip_count)}</td>
                      <td className="text-end">{formatMoney(rider.total_revenue)}</td>
                      <td
                        className={`text-end fw-semibold ${
                          rider.net_profit >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {formatProfit(rider.net_profit)}
                      </td>
                      <td className="text-end">
                        <Link to={`/app/riders/${rider.id}`} className="btn btn-sm btn-outline-primary me-1">
                          Open
                        </Link>
                        {isOwner || isAdmin ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeRider(rider.id)}
                          >
                            Remove
                          </button>
                        ) : null}
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
