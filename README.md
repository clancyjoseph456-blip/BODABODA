# 🏍️ Boda Boda Manager

A full-stack fleet management and profit analytics platform for Kenyan *boda boda*
(motorcycle taxi) operators. Log trips, get fares priced by a single tested
engine, and see the profit each bike actually makes after fuel and maintenance.

Built as both a class assignment and a portfolio project.

---

## What it does

| Feature | Detail |
| --- | --- |
| **Fare engine** | Pure, unit-tested pricing rules — base fare, per-km rate, load surcharge, seasonal multipliers |
| **Automatic fuel costing** | Every recorded trip books its own fuel cost from that rider's consumption and fuel price |
| **Trip log** | Distance, load, season, passenger — with a live server-priced fare preview before saving |
| **Expenses** | Maintenance, permits, insurance and fines tracked separately from fuel |
| **Profit analytics** | Fleet totals, per-rider profit ranking, season comparison, break-even distance per bike |
| **Roles** | `admin` sees everything, `owner` manages their fleet, `rider` sees only their own bike |
| **Audit log** | Who created or changed what, and when |

### The pricing rules

```
weight_surcharge = max(0, weight_kg − 20) × 10      # first 20 kg free, max load 100 kg
fare             = (base_fare + distance_km × rate_per_km + weight_surcharge)
                  × season_fare_multiplier
fuel_cost        = distance_km × fuel_consumption_per_km
                  × season_fuel_multiplier × fuel_price_per_litre
net_profit       = revenue − fuel_cost − other_expenses
```

| Season | Fare multiplier | Fuel multiplier |
| --- | --- | --- |
| Dry | ×1.0 | ×1.0 |
| Rainy | ×1.3 | ×1.15 |
| Holiday | ×1.5 | ×1.0 |

The browser never decides a price. The fare preview, the saved trip and the
dashboard totals all call the same `fareEngine` module, so they cannot disagree.

---

## Tech stack

- **Backend** — Node.js, Express 4, MySQL (`mysql2`), JWT auth, Zod validation
- **Frontend** — React 18, Vite, React Router, Bootstrap 5
- **Tests** — Jest, Supertest

---

## Getting started

**Prerequisites:** Node.js 18+ and a running MySQL/MariaDB server.

```bash
# 1. install everything (root, backend, frontend)
npm run setup

# 2. create the config
cp backend/.env.example backend/.env      # then edit DB_USER / DB_PASSWORD

# 3. create the schema and demo data
npm run migrate

# 4. start the API (:5001) and the web app (:5173) together
npm run dev
```

Open <http://localhost:5173>.

### Demo accounts

All use the password `Password123!`.

| Email | Role | Sees |
| --- | --- | --- |
| `admin@boda.test` | Fleet Admin | Every rider, user and report |
| `owner@boda.test` | Fleet Owner | Their own fleet |
| `rider@boda.test` | Rider | One bike, its trips and its profit |

> ⚠️ `npm run migrate` **drops and recreates** the configured database on every
> run. That is what makes the demo seed reproducible, but it means never point
> `DB_NAME` at anything you care about.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run setup` | Install root, backend and frontend dependencies |
| `npm run migrate` | Drop, recreate and seed the database |
| `npm run dev` | Run API and web app together |
| `npm run dev:backend` / `npm run dev:frontend` | Run one side only |
| `npm test` | Run the full backend test suite |
| `npm run build` | Production build of the React app |
| `npm start` | Start the API only |
| `node backend/scripts/verify.js` | Manual end-to-end check with a printed report |

---

## Tests

```bash
npm test
```

61 tests across two suites:

- **`__tests__/fareEngine.test.js`** — the business rules as pure functions,
  including the exact figures published by the original OOP exercise
  (revenue `731.00`, expenses `1,807.46`, profit `−1,076.46`) and a
  regression suite for the MySQL `DECIMAL`-as-string trap described below.
- **`__tests__/smoke.test.js`** — the real HTTP surface via Supertest against a
  live database: auth, role gates, cross-tenant isolation, trip pricing,
  expenses and analytics.

The smoke tests need a migrated database and **write to it**. To keep your demo
data clean, run them against a throwaway database:

```bash
# backend/.env  ->  DB_NAME=boda_boda_test
npm run migrate && npm test
```

---

## Project layout

```
BODABODA/
├── backend/
│   ├── server.js                 Express app, CORS, health check, route mounting
│   ├── config/db.js              MySQL connection pool
│   ├── controllers/              auth, rider, trip, expense, analytics, admin
│   ├── middleware/               JWT auth, Zod validation, error handling
│   ├── routes/                   /api/auth, /riders, /analytics, /admin
│   ├── services/fareEngine.js    ★ the pricing rules — pure, no I/O
│   ├── utils/asyncHandler.js     forwards async rejections to Express
│   ├── database/                 schema.sql + migrate.js (drop, create, seed)
│   ├── scripts/verify.js         end-to-end manual check
│   └── __tests__/                unit + smoke tests
└── frontend/
    └── src/
        ├── context/AuthContext   session state, revalidated against /auth/me
        ├── layouts/DashboardShell
        ├── pages/public/         landing page, login, register
        ├── pages/dashboard/      overview, riders, trip log, analytics, users
        └── services/             axios client, formatting helpers
```

---

## API reference

All `/api/*` routes except `/api/seasons` and `/api/health` require
`Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account (always as `rider`) |
| `POST` | `/api/auth/login` | Sign in, returns a JWT |
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/riders` | Riders visible to the caller |
| `POST` | `/api/riders` | Add a rider with its own pricing rules |
| `GET` | `/api/riders/:id` | One rider |
| `GET` | `/api/riders/:id/summary` | Trips, expenses and net profit |
| `POST` | `/api/riders/quote` | Price a trip without saving it |
| `GET` | `/api/riders/:id/trips` | Trip list (`?season=`, `?from=`, `?to=`) |
| `POST` | `/api/riders/:id/trips` | Record a trip — priced server-side |
| `DELETE` | `/api/riders/:id/trips/:tripId` | Remove a trip |
| `GET` | `/api/riders/:id/expenses` | Manual expenses |
| `POST` | `/api/riders/:id/expenses` | Add a manual expense |
| `DELETE` | `/api/riders/:id/expenses/:expenseId` | Remove an expense |
| `GET` | `/api/analytics/overview` | Fleet headline totals |
| `GET` | `/api/analytics/riders` | Profit ranking per rider |
| `GET` | `/api/analytics/seasons` | Performance by season |
| `GET` | `/api/analytics/break-even` | Break-even distance per bike |
| `GET` | `/api/admin/users` | All accounts *(admin only)* |
| `PUT` | `/api/admin/users/:id/status` | Suspend or reactivate *(admin only)* |
| `GET` | `/api/seasons` | Public pricing multipliers |
| `GET` | `/api/health` | Liveness + database check |

---

## Notes on the implementation

A few decisions worth calling out, each of which fixed a real problem:

**MySQL returns `DECIMAL` columns as JavaScript strings.** That made
`base_fare + distance * rate` evaluate as `'60.00' + 250`, which JavaScript
*concatenates* into `'60.00250'` rather than adding — silently collapsing every
fare to roughly the base fare. All rates are now coerced once, at the single
point where settings enter the engine (`resolveSettings`), and
`__tests__/fareEngine.test.js` guards the behaviour.

**Express 4 only catches synchronous throws.** An `async` controller that
rejected — a failed query, a `403` from an access check — left the request
hanging until the client timed out. Every route handler is wrapped in
`utils/asyncHandler.js` so failures reach the error middleware.

**Zod strips unknown keys.** The fare-quote schema originally omitted
`rider_id`, so validation silently deleted it and every quote 404'd.

**Load is stored per trip, not on the rider.** The original OOP exercise kept
`self.weight` across trips, so `record_trip(6)` with no weight argument reused
the previous trip's load. That was a latent bug and is not reproduced here.

**Money is rounded at the trip boundary** rather than accumulated in floating
point, so totals reconcile exactly against the reference figures.
