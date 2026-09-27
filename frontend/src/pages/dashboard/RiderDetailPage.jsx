import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DashboardShell from '../../layouts/DashboardShell';
import { ErrorAlert, Loading, MoneyStat, StatCard, EmptyState } from '../../components/StatCard';
import { formatDateTime, formatMoney, formatNumber, formatProfit, seasonTone } from '../../services/format';

const SEASONS = [
  { key: 'dry', label: 'Dry', fare_multiplier: 1, fuel_multiplier: 1 },
  { key: 'rainy', label: 'Rainy', fare_multiplier: 1.3, fuel_multiplier: 1.15 },
  { key: 'holiday', label: 'Holiday', fare_multiplier: 1.5, fuel_multiplier: 1 }
];

const EMPTY_FORM = { distance_km: '', weight_kg: '', season_key: 'dry', passenger: '' };

/** Trip log + fare breakdown for one bike. This is the screen used most often. */
export default function RiderDetailPage() {
  const { riderId } = useParams();
  const navigate = useNavigate();
  const { isRider } = useAuth();

  const [riders, setRiders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trips, setTrips] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [quote, setQuote] = useState(null);
  const [tab, setTab] = useState('trips');
  const [expenseForm, setExpenseForm] = useState({ label: '', amount: '', category: 'maintenance' });

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, tripsRes, expensesRes, ridersRes] = await Promise.all([
        api.get(`/riders/${riderId}/summary`),
        api.get(`/riders/${riderId}/trips`),
        api.get(`/riders/${riderId}/expenses`),
        api.get('/riders')
      ]);
      setSummary(summaryRes.data);
      setTrips(tripsRes.data);
      setExpenses(expensesRes.data);
      setRiders(ridersRes.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this rider.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

  // Ask the server for a price as the rider types. The server owns the pricing
  // rules, so the preview can never drift from what a trip actually costs.
  useEffect(() => {
    const distance = Number(form.distance_km);
    if (!distance || distance <= 0) {
      setQuote(null);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post('/riders/quote', {
          rider_id: Number(riderId),
          distance_km: distance,
          weight_kg: Number(form.weight_kg) || 0,
          season_key: form.season_key
        });
        setQuote(data);
      } catch {
        setQuote(null);
      }
    }, 350); // debounce so every keystroke is not a request

    return () => clearTimeout(timer);
  }, [form.distance_km, form.weight_kg, form.season_key, riderId]);

  const season = useMemo(
    () => SEASONS.find((s) => s.key === form.season_key) || SEASONS[0],
    [form.season_key]
  );

  async function submitTrip(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.post(`/riders/${riderId}/trips`, {
        distance_km: Number(form.distance_km),
        weight_kg: Number(form.weight_kg) || 0,
        season_key: form.season_key,
        passenger: form.passenger.trim() || null
      });
      setForm(EMPTY_FORM);
      setQuote(null);
      await loadAll();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save that trip.'));
    } finally {
      setSaving(false);
    }
  }

  async function submitExpense(event) {
    event.preventDefault();
    setFormError('');
    try {
      await api.post(`/riders/${riderId}/expenses`, {
        label: expenseForm.label.trim(),
        amount: Number(expenseForm.amount),
        category: expenseForm.category
      });
      setExpenseForm({ label: '', amount: '', category: 'maintenance' });
      await loadAll();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save that expense.'));
    }
  }

  async function removeTrip(id) {
    try {
      await api.delete(`/riders/${riderId}/trips/${id}`);
      await loadAll();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not delete that trip.'));
    }
  }

  async function removeExpense(id) {
    try {
      await api.delete(`/riders/${riderId}/expenses/${id}`);
      await loadAll();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not delete that expense.'));
    }
  }

  const rider = summary?.rider;

  return (
    <DashboardShell
      title={rider ? `${rider.bike_model} · ${rider.registration_number}` : 'Rider'}
      subtitle={isRider ? 'Your trips and running costs.' : 'Trip log, expenses and profit.'}
      actions={
        riders.length > 1 ? (
          <select
            className="form-select form-select-sm w-auto"
            value={riderId}
            onChange={(e) => navigate(`/app/riders/${e.target.value}`)}
            aria-label="Switch rider"
          >
            {riders.map((item) => (
              <option key={item.id} value={item.id}>
                {item.bike_model} · {item.registration_number}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {loading ? <Loading /> : null}
      {!loading && error ? (
        <>
          <ErrorAlert message={error} />
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/app/riders')}>
            Back to riders
          </button>
        </>
      ) : null}

      {!loading && !error && summary ? (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <MoneyStat label="Revenue" value={summary.total_revenue} sub={`${formatNumber(summary.trip_count)} trips`} />
            </div>
            <div className="col-6 col-lg-3">
              <MoneyStat label="Fuel" value={summary.fuel_spend} sub={`${formatMoney(summary.fuel_cost_per_km)} per km`} />
            </div>
            <div className="col-6 col-lg-3">
              <MoneyStat label="Other costs" value={summary.other_expenses} sub="Maintenance, permits, fines" />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard
                label="Net profit"
                value={formatProfit(summary.net_profit)}
                tone={summary.net_profit >= 0 ? 'positive' : 'negative'}
                sub={`Break-even at ${formatNumber(summary.break_even_km)} km`}
              />
            </div>
          </div>

          <div className="row g-3">
            <div className="col-lg-5">
              <div className="card shadow-sm mb-3">
                <div className="card-header bg-white">
                  <h2 className="h6 mb-0">Log a trip</h2>
                </div>
                <div className="card-body">
                  <ErrorAlert message={formError} onDismiss={() => setFormError('')} />
                  <form onSubmit={submitTrip}>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="distance">Distance (km)</label>
                      <input
                        id="distance"
                        type="number"
                        step="0.1"
                        min="0.1"
                        required
                        className="form-control"
                        value={form.distance_km}
                        onChange={(e) => setForm({ ...form, distance_km: e.target.value })}
                        placeholder="e.g. 5"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="weight">Load (kg)</label>
                      <input
                        id="weight"
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        className="form-control"
                        value={form.weight_kg}
                        onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                        placeholder="Free up to 20 kg"
                      />
                      <div className="form-text">First 20 kg are free, then KSh 10 per extra kg.</div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="season">Season</label>
                      <select
                        id="season"
                        className="form-select"
                        value={form.season_key}
                        onChange={(e) => setForm({ ...form, season_key: e.target.value })}
                      >
                        {SEASONS.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label} (×{s.fare_multiplier} fare)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="passenger">Passenger / note</label>
                      <input
                        id="passenger"
                        type="text"
                        className="form-control"
                        value={form.passenger}
                        onChange={(e) => setForm({ ...form, passenger: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>

                    <button type="submit" className="btn btn-primary w-100" disabled={saving}>
                      {saving ? 'Saving…' : 'Record trip'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Live price preview — proves the season markup is being applied. */}
              {quote ? (
                <div className="card shadow-sm border-primary">
                  <div className="card-header bg-white d-flex justify-content-between align-items-center">
                    <h2 className="h6 mb-0">Fare preview</h2>
                    <span className={`badge text-bg-${seasonTone(season.key)}`}>{season.label}</span>
                  </div>
                  <div className="card-body small">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Fare</span>
                      <span className="fw-semibold">{formatMoney(quote.fare)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Fuel cost</span>
                      <span className="text-danger">−{formatMoney(quote.fuel_cost)}</span>
                    </div>
                    <hr className="my-2" />
                    <div className="d-flex justify-content-between">
                      <span className="fw-semibold">Net for this trip</span>
                      <span className={`fw-semibold ${quote.net >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatProfit(quote.net)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="col-lg-7">
              <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${tab === 'trips' ? 'active' : ''}`}
                    onClick={() => setTab('trips')}
                  >
                    Trips ({trips.length})
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${tab === 'expenses' ? 'active' : ''}`}
                    onClick={() => setTab('expenses')}
                  >
                    Expenses ({expenses.length})
                  </button>
                </li>
              </ul>

              {tab === 'trips' ? (
                <div className="card shadow-sm">
                  <div className="card-body p-0">
                    {trips.length === 0 ? (
                      <EmptyState title="No trips yet">Log the first trip to start building the ledger.</EmptyState>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>When</th>
                              <th className="text-end">Km</th>
                              <th className="text-end">Load</th>
                              <th>Season</th>
                              <th className="text-end">Fare</th>
                              <th className="text-end">Net</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {trips.map((trip) => (
                              <tr key={trip.id}>
                                <td className="text-muted small">
                                  {formatDateTime(trip.created_at)}
                                  {trip.passenger ? <div>{trip.passenger}</div> : null}
                                </td>
                                <td className="text-end">{formatNumber(trip.distance_km)}</td>
                                <td className="text-end">{formatNumber(trip.weight_kg)} kg</td>
                                <td>
                                  <span className={`badge text-bg-${seasonTone(trip.season_key)}`}>
                                    {trip.season_key}
                                  </span>
                                </td>
                                <td className="text-end">{formatMoney(trip.fare)}</td>
                                <td className={`text-end fw-semibold ${trip.net >= 0 ? 'text-success' : 'text-danger'}`}>
                                  {formatProfit(trip.net)}
                                </td>
                                <td className="text-end">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-link text-danger p-0"
                                    onClick={() => removeTrip(trip.id)}
                                    aria-label="Delete trip"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="card shadow-sm">
                  <div className="card-body">
                    <form className="row g-2 align-items-end mb-3" onSubmit={submitExpense}>
                      <div className="col-12 col-md-5">
                        <label className="form-label small" htmlFor="expense-label">Description</label>
                        <input
                          id="expense-label"
                          type="text"
                          required
                          className="form-control form-control-sm"
                          value={expenseForm.label}
                          onChange={(e) => setExpenseForm({ ...expenseForm, label: e.target.value })}
                          placeholder="Brake pads"
                        />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label small" htmlFor="expense-category">Category</label>
                        <select
                          id="expense-category"
                          className="form-select form-select-sm"
                          value={expenseForm.category}
                          onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                        >
                          {['maintenance', 'permits', 'insurance', 'fines', 'other'].map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-2">
                        <label className="form-label small" htmlFor="expense-amount">Amount (KSh)</label>
                        <input
                          id="expense-amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          className="form-control form-control-sm"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        />
                      </div>
                      <div className="col-12 col-md-2">
                        <button type="submit" className="btn btn-sm btn-primary w-100">Add</button>
                      </div>
                    </form>

                    {expenses.length === 0 ? (
                      <EmptyState title="No other expenses">
                        Fuel is booked automatically from each trip, so only add everything else here.
                      </EmptyState>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Date</th>
                              <th>Description</th>
                              <th>Category</th>
                              <th className="text-end">Amount</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {expenses.map((expense) => (
                              <tr key={expense.id}>
                                <td className="text-muted small">{formatDateTime(expense.created_at)}</td>
                                <td>{expense.label}</td>
                                <td>
                                  <span className="badge text-bg-light text-dark">{expense.category}</span>
                                </td>
                                <td className="text-end text-danger">{formatMoney(expense.amount)}</td>
                                <td className="text-end">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-link text-danger p-0"
                                    onClick={() => removeExpense(expense.id)}
                                    aria-label="Delete expense"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </DashboardShell>
  );
}
