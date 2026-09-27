-- ─────────────────────────────────────────────────────────────────────────────
-- Boda Boda Manager — schema
--
-- Design notes:
--   * `weight_kg` lives on `trips`, not on `riders`. Load is a property of a
--     particular journey, never a persistent rider attribute.
--   * `fuel_cost` is stored on the trip rather than re-derived on read, so a
--     historical report never shifts when fuel prices change.
--   * `seasons` is a table rather than an enum so multipliers can be tuned
--     without a code deploy.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  phone         VARCHAR(30),
  password      VARCHAR(255) NOT NULL,
  -- admin: manages every rider. owner: manages their own fleet.
  -- rider: records their own trips and expenses.
  role          ENUM('admin', 'owner', 'rider') NOT NULL DEFAULT 'rider',
  status        ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE seasons (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  season_key      VARCHAR(20) NOT NULL UNIQUE,
  label           VARCHAR(40) NOT NULL,
  fare_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  fuel_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00
);

-- One row per bike/operator. Pricing knobs are per-rider so a fleet can mix
-- e.g. a Bajaj Boxer and a Yamaha FZ with different base fares.
CREATE TABLE riders (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  user_id                INT NOT NULL,
  bike_model             VARCHAR(80) NOT NULL,
  registration_number    VARCHAR(40),
  base_fare              DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  rate_per_km            DECIMAL(10,2) NOT NULL DEFAULT 20.00,
  fuel_price_per_litre   DECIMAL(10,2) NOT NULL DEFAULT 180.00,
  fuel_consumption_per_km DECIMAL(6,3) NOT NULL DEFAULT 0.030,
  status                 ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_riders_user (user_id)
);

CREATE TABLE trips (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  rider_id     INT NOT NULL,
  distance_km  DECIMAL(8,2) NOT NULL,
  weight_kg    DECIMAL(6,2) NOT NULL DEFAULT 0,
  season_key   VARCHAR(20) NOT NULL DEFAULT 'dry',
  -- Denormalised from fareEngine at write time; see schema note above.
  fare         DECIMAL(10,2) NOT NULL,
  fuel_cost    DECIMAL(10,2) NOT NULL DEFAULT 0,
  passenger    VARCHAR(120),
  notes        TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
  INDEX idx_trips_rider (rider_id),
  INDEX idx_trips_created (created_at)
);

-- Manual costs (fuel is booked automatically on trip creation, never here).
CREATE TABLE expenses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  rider_id    INT NOT NULL,
  label       VARCHAR(160) NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  category    VARCHAR(40) NOT NULL DEFAULT 'other',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
  INDEX idx_expenses_rider (rider_id)
);

CREATE TABLE audit_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  action      VARCHAR(160) NOT NULL,
  entity      VARCHAR(60),
  entity_id   INT,
  details     TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_user (user_id)
);
