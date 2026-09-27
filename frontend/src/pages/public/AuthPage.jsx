import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ErrorAlert } from '../../components/StatCard';

const BLANK = { full_name: '', email: '', phone: '', password: '', confirm: '' };

/** Combined sign-in / sign-up. New accounts are always created as riders. */
export default function AuthPage({ mode = 'login' }) {
  const isRegister = mode === 'register';
  const navigate = useNavigate();
  const { signIn, register, user } = useAuth();

  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Already signed in? Skip straight to the dashboard.
  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setError('');

    if (isRegister && form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    if (isRegister && form.password.length < 8) {
      setError('Choose a password of at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      if (isRegister) {
        await register({
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          password: form.password
        });
      } else {
        await signIn(form.email.trim().toLowerCase(), form.password);
      }
      navigate('/app', { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          (isRegister ? 'Could not create that account.' : 'Email or password is incorrect.')
      );
    } finally {
      setBusy(false);
    }
  }

  function useDemoAccount(demoEmail) {
    setForm({ ...BLANK, email: demoEmail, password: 'Password123!' });
    setError('');
  }

  return (
    <div className="auth-page d-flex align-items-center justify-content-center p-3">
      <div className="card shadow-sm auth-card w-100">
        <div className="card-body p-4">
          <Link to="/" className="d-inline-block mb-3 text-decoration-none text-muted small">
            ← Back to home
          </Link>
          <h1 className="h4 mb-1">{isRegister ? 'Create your account' : 'Sign in'}</h1>
          <p className="text-muted small mb-4">
            {isRegister
              ? 'New accounts start as a rider. An admin can promote you to fleet owner.'
              : 'Track trips, expenses and the profit your bikes actually make.'}
          </p>

          <ErrorAlert message={error} onDismiss={() => setError('')} />

          <form onSubmit={submit}>
            {isRegister ? (
              <div className="mb-3">
                <label className="form-label" htmlFor="full_name">Full name</label>
                <input
                  id="full_name"
                  type="text"
                  required
                  className="form-control"
                  value={form.full_name}
                  onChange={update('full_name')}
                  placeholder="Achieng Odhiambo"
                />
              </div>
            ) : null}

            <div className="mb-3">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="form-control"
                value={form.email}
                onChange={update('email')}
                placeholder="you@example.com"
              />
            </div>

            {isRegister ? (
              <div className="mb-3">
                <label className="form-label" htmlFor="phone">Phone (optional)</label>
                <input
                  id="phone"
                  type="tel"
                  className="form-control"
                  value={form.phone}
                  onChange={update('phone')}
                  placeholder="+254 7XX XXX XXX"
                />
              </div>
            ) : null}

            <div className="mb-3">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="form-control"
                value={form.password}
                onChange={update('password')}
                placeholder="••••••••"
              />
            </div>

            {isRegister ? (
              <div className="mb-3">
                <label className="form-label" htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="form-control"
                  value={form.confirm}
                  onChange={update('confirm')}
                />
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary w-100" disabled={busy}>
              {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="text-center small text-muted mt-3 mb-0">
            {isRegister ? 'Already have an account? ' : 'No account yet? '}
            <Link to={isRegister ? '/login' : '/register'}>
              {isRegister ? 'Sign in' : 'Create one'}
            </Link>
          </p>
        </div>
      </div>

      {!isRegister ? (
        <div className="card shadow-sm auth-card w-100 mt-3">
          <div className="card-body p-3">
            <p className="small fw-semibold mb-2">Demo accounts</p>
            <div className="d-grid gap-2">
              {[
                { email: 'admin@boda.test', label: 'Fleet admin — sees everything' },
                { email: 'owner@boda.test', label: 'Fleet owner — manages a fleet' },
                { email: 'rider@boda.test', label: 'Rider — one bike' }
              ].map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-start"
                  onClick={() => useDemoAccount(demo.email)}
                >
                  <span className="d-block fw-semibold">{demo.label}</span>
                  <span className="d-block text-muted small">{demo.email}</span>
                </button>
              ))}
            </div>
            <p className="text-muted small mb-0 mt-2">All demo accounts use password Password123!</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
