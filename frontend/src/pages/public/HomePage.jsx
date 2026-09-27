import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../services/format';

const SEASON_COPY = {
  dry: 'Normal trading. Base fares apply.',
  rainy: 'Fares up 30%, and rain pushes fuel burn up 15%.',
  holiday: 'Fares up 50% on public holidays.'
};

/** Public marketing page. The season table is fetched from the API so the
 *  pricing shown to visitors can never disagree with the pricing engine. */
export default function HomePage() {
  const { user } = useAuth();
  const [seasons, setSeasons] = useState([]);

  useEffect(() => {
    api
      .get('/seasons')
      .then(({ data }) => setSeasons(data))
      .catch(() => setSeasons([]));
  }, []);

  return (
    <div className="landing">
      <nav className="container d-flex justify-content-between align-items-center py-3">
        <span className="brand d-flex align-items-center gap-2">
          <span className="brand-mark" aria-hidden="true">🏍️</span>
          <span className="brand-text">Boda Manager</span>
        </span>
        <div className="d-flex gap-2">
          {user ? (
            <Link to="/app" className="btn btn-primary btn-sm">Open dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline-secondary btn-sm">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>
      </nav>

      <header className="container py-5">
        <div className="row align-items-center g-5">
          <div className="col-lg-7">
            <span className="badge text-bg-light text-dark border mb-3">Built for Kenyan boda operators</span>
            <h1 className="display-5 fw-bold mb-3">
              Know exactly what your bikes earn — and what they cost you.
            </h1>
            <p className="lead text-muted mb-4">
              Log every trip, let fares be priced by the same rules your customers see, and watch fuel,
              maintenance and net profit update in real time. No spreadsheet, no guesswork.
            </p>
            <div className="d-flex gap-2 flex-wrap">
              <Link to={user ? '/app' : '/register'} className="btn btn-primary btn-lg">
                {user ? 'Open dashboard' : 'Start free'}
              </Link>
              {!user ? (
                <Link to="/login" className="btn btn-outline-secondary btn-lg">
                  Try a demo account
                </Link>
              ) : null}
            </div>
          </div>

          <div className="col-lg-5">
            <div className="card shadow-sm">
              <div className="card-body">
                <p className="text-muted small mb-3">How a trip is priced</p>
                <div className="mb-2">
                  <span className="text-muted small">Base fare</span>
                  <span className="float-end fw-semibold">{formatMoney(50)}</span>
                </div>
                <div className="mb-2">
                  <span className="text-muted small">Per km × distance</span>
                  <span className="float-end fw-semibold">{formatMoney(20)}</span>
                </div>
                <div className="mb-3">
                  <span className="text-muted small">Load surcharge (over 20 kg)</span>
                  <span className="float-end fw-semibold">{formatMoney(10)} / kg</span>
                </div>
                <hr />
                <p className="small mb-1">
                  <strong>8 km, 35 kg, rainy season</strong>
                </p>
                <p className="small text-muted mb-2">
                  (50 + 8×20 + 15×10) × 1.3
                </p>
                <p className="h5 mb-0">{formatMoney(360)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="container py-5">
        <h2 className="h3 fw-bold mb-4">Three seasons, three pricing rules</h2>
        <div className="row g-3">
          {(seasons.length ? seasons : ['dry', 'rainy', 'holiday']).map((season) => {
            const key = typeof season === 'string' ? season : season.key;
            const fare = typeof season === 'string' ? null : season.fare_multiplier;
            return (
              <div className="col-md-4" key={key}>
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <h3 className="h6 text-capitalize mb-2">{key}</h3>
                    {fare ? (
                      <p className="h4 mb-2">×{fare} fare</p>
                    ) : (
                      <p className="h4 mb-2">—</p>
                    )}
                    <p className="text-muted small mb-0">{SEASON_COPY[key]}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="container py-5">
        <div className="row g-3">
          {[
            {
              title: 'Fares priced by one engine',
              body: 'The browser never decides a price. Every quote and every saved trip goes through the same tested calculation, so the preview always matches the bill.'
            },
            {
              title: 'Fuel costed automatically',
              body: 'Recording a distance books the fuel cost for that trip at the rider’s own consumption and fuel price. Running costs cannot be forgotten.'
            },
            {
              title: 'Profit you can defend',
              body: 'Revenue minus fuel minus maintenance, with break-even distance per bike — the numbers needed to decide whether a route is worth keeping.'
            }
          ].map((feature) => (
            <div className="col-md-4" key={feature.title}>
              <div className="card h-100 border-0 bg-light">
                <div className="card-body">
                  <h3 className="h6 mb-2">{feature.title}</h3>
                  <p className="text-muted small mb-0">{feature.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="container py-5 text-center text-muted small">
        <p className="mb-0">Boda Boda Manager — fleet profit analytics.</p>
      </footer>
    </div>
  );
}
