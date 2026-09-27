/**
 * fareEngine.js — Core boda boda business rules.
 *
 * This is a faithful JavaScript port of the `bodaboda_business` class from the
 * original OOP exercise, with two deliberate improvements:
 *
 *   1. Every calculation is a PURE function. No instance state, no side effects.
 *      That makes the rules unit-testable and safe to call from HTTP handlers.
 *   2. `weight_kg` is stored per-trip, not on the rider. The original kept
 *      `self.weight` across trips, so `record_trip(6)` with no weight argument
 *      silently reused the previous trip's load. That was a latent bug.
 *
 * ── The formulas ────────────────────────────────────────────────────────────
 *
 *   weight_surcharge = max(0, weight_kg - FREE_WEIGHT_KG) * WEIGHT_SURCHARGE_PER_KG
 *   fare             = (base_fare + distance_km*rate_per_km + surcharge)
 *                      * season_fare_multiplier
 *   fuel_cost        = distance_km * fuel_consumption_per_km
 *                      * season_fuel_multiplier * fuel_price_per_litre
 *   profit           = revenue - expenses
 *
 * Money is rounded to 2 decimals at each trip boundary, matching the reference
 * implementation so totals reconcile against the published benchmark fixtures.
 */

const CURRENCY_PRECISION = 2;

/** Seasons and their price/fuel multipliers. Rain raises fares *and* fuel burn. */
const SEASONS = {
  dry: { key: 'dry', label: 'Dry', fare_multiplier: 1.0, fuel_multiplier: 1.0 },
  rainy: { key: 'rainy', label: 'Rainy', fare_multiplier: 1.3, fuel_multiplier: 1.15 },
  holiday: { key: 'holiday', label: 'Holiday', fare_multiplier: 1.5, fuel_multiplier: 1.0 }
};

/** Kilograms included in the base fare before surcharging kicks in. */
const FREE_WEIGHT_KG = 20;

/** Charged per kilogram above the free allowance. */
const WEIGHT_SURCHARGE_PER_KG = 10;

/** Hard capacity limit — beyond this the bike needs a different vehicle. */
const MAX_LOAD_KG = 100;

/** Sensible defaults matching the Kenyan market the reference model assumed. */
const DEFAULT_RIDER_SETTINGS = {
  base_fare: 50,
  rate_per_km: 20,
  fuel_price_per_litre: 180,
  fuel_consumption_per_km: 0.03
};

/** Round to 2 decimals, avoiding binary float drift (0.1+0.2 problems). */
function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function isValidSeason(season) {
  return Object.prototype.hasOwnProperty.call(SEASONS, season);
}

function getSeason(season) {
  if (!isValidSeason(season)) {
    throw new RangeError(
      `Unknown season "${season}". Expected one of: ${Object.keys(SEASONS).join(', ')}.`
    );
  }
  return SEASONS[season];
}

function assertPositiveNumber(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new RangeError(`${field} must be a non-negative number (received ${value}).`);
  }
  return num;
}

/**
 * Merge caller settings over the defaults, coercing every rate to a real number.
 *
 * This is not cosmetic. MySQL returns DECIMAL columns as STRINGS, so a row
 * typed `base_fare = '60.00'` would otherwise reach `base_fare + distance * rate`
 * as `'60.00' + 250`, which JavaScript concatenates into `'60.00250'` instead of
 * adding. Every fare would silently collapse to roughly the base fare. Coercing
 * at the single point where settings enter the engine makes that class of bug
 * impossible regardless of what the caller passes.
 */
function resolveSettings(settings = {}) {
  const merged = { ...DEFAULT_RIDER_SETTINGS, ...settings };
  return {
    base_fare: assertPositiveNumber(merged.base_fare, 'base_fare'),
    rate_per_km: assertPositiveNumber(merged.rate_per_km, 'rate_per_km'),
    fuel_price_per_litre: assertPositiveNumber(merged.fuel_price_per_litre, 'fuel_price_per_litre'),
    fuel_consumption_per_km: assertPositiveNumber(merged.fuel_consumption_per_km, 'fuel_consumption_per_km')
  };
}

/**
 * Charge only for load beyond the free allowance.
 * A 35kg load carries 15kg of surcharge = 150.
 */
function calculateWeightSurcharge(weightKg) {
  const weight = assertPositiveNumber(weightKg, 'weight_kg');
  if (weight > MAX_LOAD_KG) {
    throw new RangeError(`Load of ${weight}kg exceeds the ${MAX_LOAD_KG}kg maximum capacity.`);
  }
  const excess = Math.max(0, weight - FREE_WEIGHT_KG);
  return money(excess * WEIGHT_SURCHARGE_PER_KG);
}

/**
 * Total fare for a trip, before fuel.
 * Seasonal markup applies to the whole amount, including the base fare.
 */
function calculateFare({ distance_km, weight_kg, season = 'dry', ...settings }) {
  const distance = assertPositiveNumber(distance_km, 'distance_km');
  const rules = getSeason(season);
  const config = resolveSettings(settings);

  const distanceCost = distance * config.rate_per_km;
  const surcharge = calculateWeightSurcharge(weight_kg ?? 0);
  const subtotal = config.base_fare + distanceCost + surcharge;

  return money(subtotal * rules.fare_multiplier);
}

/**
 * Fuel burned for a trip. Rainy riding costs more fuel, which is why the
 * rain multiplier exists separately from the fare multiplier.
 */
function calculateFuelCost({ distance_km, season = 'dry', ...settings }) {
  const distance = assertPositiveNumber(distance_km, 'distance_km');
  const rules = getSeason(season);
  const config = resolveSettings(settings);

  const litres = distance * config.fuel_consumption_per_km;
  return money(litres * rules.fuel_multiplier * config.fuel_price_per_litre);
}

/**
 * Full breakdown of a single trip: what the rider earns and what it costs them.
 * The API returns this object directly so the frontend can show a fare preview
 * before committing a trip.
 */
function quoteTrip(input) {
  const fare = calculateFare(input);
  const fuelCost = calculateFuelCost(input);
  return {
    distance_km: Number(input.distance_km),
    weight_kg: Number(input.weight_kg ?? 0),
    season: input.season ?? 'dry',
    fare,
    fuel_cost: fuelCost,
    net: money(fare - fuelCost)
  };
}

/**
 * Distance a rider must cover before fuel costs cancel out the fare income.
 * Returns null when the rate per km never covers fuel (negative margin).
 */
function breakEvenDistanceKm(settings) {
  const config = resolveSettings(settings);
  const fuelPerKm = config.fuel_consumption_per_km * config.fuel_price_per_litre;
  const marginPerKm = config.rate_per_km - fuelPerKm;
  if (marginPerKm <= 0) return null;
  return money(config.base_fare / marginPerKm);
}

/**
 * Fold a set of trips and expenses into a profit summary.
 * This replaces the reference `summary()` method, which printed to stdout.
 * Returning data instead of printing makes it usable from an HTTP handler.
 */
function summarise({ trips = [], expenses = [], settings = {} } = {}) {
  const config = resolveSettings(settings);

  const revenue = money(trips.reduce((sum, t) => sum + Number(t.fare), 0));
  const distance = trips.reduce((sum, t) => sum + Number(t.distance_km), 0);
  const fuelSpend = money(trips.reduce((sum, t) => sum + Number(t.fuel_cost), 0));
  const manualSpend = money(expenses.reduce((sum, e) => sum + Number(e.amount), 0));
  const totalExpenses = money(fuelSpend + manualSpend);

  return {
    trip_count: trips.length,
    total_distance_km: money(distance),
    total_revenue: revenue,
    fuel_spend: fuelSpend,
    other_expenses: manualSpend,
    total_expenses: totalExpenses,
    net_profit: money(revenue - totalExpenses),
    avg_fare_per_trip: trips.length ? money(revenue / trips.length) : 0,
    avg_fare_per_km: distance > 0 ? money(revenue / distance) : 0,
    fuel_cost_per_km: distance > 0 ? money(fuelSpend / distance) : 0,
    break_even_km: breakEvenDistanceKm(config)
  };
}

module.exports = {
  SEASONS,
  FREE_WEIGHT_KG,
  WEIGHT_SURCHARGE_PER_KG,
  MAX_LOAD_KG,
  CURRENCY_PRECISION,
  DEFAULT_RIDER_SETTINGS,
  money,
  isValidSeason,
  getSeason,
  resolveSettings,
  calculateWeightSurcharge,
  calculateFare,
  calculateFuelCost,
  quoteTrip,
  breakEvenDistanceKm,
  summarise
};
