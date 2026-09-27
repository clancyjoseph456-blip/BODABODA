/**
 * fareEngine.test.js — Unit tests for the core boda boda business rules.
 *
 * The fixtures in `describe('reference benchmark')` are the exact figures
 * published by the original `bodaboda_business` OOP exercise. They are the
 * contract: if these pass, the port is faithful.
 */

const {
  SEASONS,
  FREE_WEIGHT_KG,
  MAX_LOAD_KG,
  DEFAULT_RIDER_SETTINGS,
  calculateWeightSurcharge,
  calculateFare,
  calculateFuelCost,
  quoteTrip,
  breakEvenDistanceKm,
  resolveSettings,
  summarise
} = require('../services/fareEngine');

describe('seasons', () => {
  it('defines dry, rainy and holiday', () => {
    expect(Object.keys(SEASONS)).toEqual(['dry', 'rainy', 'holiday']);
  });

  it('applies the documented multipliers', () => {
    expect(SEASONS.dry.fare_multiplier).toBe(1.0);
    expect(SEASONS.rainy.fare_multiplier).toBe(1.3);
    expect(SEASONS.holiday.fare_multiplier).toBe(1.5);
    expect(SEASONS.rainy.fuel_multiplier).toBe(1.15);
  });

  it('rejects an unknown season', () => {
    expect(() => calculateFare({ distance_km: 5, season: 'monsoon' })).toThrow(RangeError);
  });
});

describe('weight surcharge', () => {
  it('charges nothing at or below the free allowance', () => {
    expect(calculateWeightSurcharge(0)).toBe(0);
    expect(calculateWeightSurcharge(10)).toBe(0);
    expect(calculateWeightSurcharge(FREE_WEIGHT_KG)).toBe(0);
  });

  it('charges 10 per kilogram beyond the allowance', () => {
    expect(calculateWeightSurcharge(35)).toBe(150); // 15kg over x 10
    expect(calculateWeightSurcharge(21)).toBe(10);
  });

  it('rejects loads over the maximum capacity', () => {
    expect(() => calculateWeightSurcharge(MAX_LOAD_KG + 1)).toThrow(RangeError);
  });

  it('rejects negative weights', () => {
    expect(() => calculateWeightSurcharge(-5)).toThrow(RangeError);
  });
});

describe('fare calculation', () => {
  it('combines base fare, distance and surcharge', () => {
    // 50 base + 5km*20 + 0 surcharge = 150
    expect(calculateFare({ distance_km: 5, weight_kg: 10, season: 'dry' })).toBe(150);
  });

  it('applies the seasonal markup to the whole subtotal', () => {
    // 50 + 6*20 + 0 = 170, then x1.3 = 221
    expect(calculateFare({ distance_km: 6, weight_kg: 15, season: 'rainy' })).toBe(221);
  });

  it('multiplies by 1.5 on holidays', () => {
    // 50 + 4*20 = 130, then x1.5 = 195
    expect(calculateFare({ distance_km: 4, weight_kg: 0, season: 'holiday' })).toBe(195);
  });

  it('honours per-rider overrides', () => {
    expect(
      calculateFare({ distance_km: 10, weight_kg: 0, base_fare: 100, rate_per_km: 30 })
    ).toBe(400); // 100 + 10*30
  });

  it('rejects a negative distance', () => {
    expect(() => calculateFare({ distance_km: -1 })).toThrow(RangeError);
  });
});

describe('fuel cost', () => {
  it('charges distance x consumption x price', () => {
    // 5 * 0.03 * 1.0 * 180 = 27
    expect(calculateFuelCost({ distance_km: 5, season: 'dry' })).toBe(27);
  });

  it('burns more fuel in the rain', () => {
    // 6 * 0.03 * 1.15 * 180 = 37.26
    expect(calculateFuelCost({ distance_km: 6, season: 'rainy' })).toBe(37.26);
  });
});

describe('quoteTrip', () => {
  it('returns fare, fuel cost and net for one trip', () => {
    expect(quoteTrip({ distance_km: 5, weight_kg: 10, season: 'dry' })).toEqual({
      distance_km: 5,
      weight_kg: 10,
      season: 'dry',
      fare: 150,
      fuel_cost: 27,
      net: 123
    });
  });
});

describe('break-even distance', () => {
  it('computes the distance needed to cover the base fare', () => {
    // fuel/km = 0.03*180 = 5.4; margin/km = 20-5.4 = 14.6; 50/14.6 = 3.42
    expect(breakEvenDistanceKm({})).toBe(3.42);
  });

  it('returns null when fuel outweighs the per-km rate', () => {
    expect(breakEvenDistanceKm({ rate_per_km: 1, fuel_price_per_litre: 1000 })).toBeNull();
  });
});

/**
 * The canonical fixtures from the reference implementation, verified to
 * reproduce its published output exactly.
 */
describe('reference benchmark', () => {
  const trips = [
    { distance_km: 5, weight_kg: 10, season: 'dry', fare: 150, fuel_cost: 27 },
    { distance_km: 8, weight_kg: 35, season: 'dry', fare: 360, fuel_cost: 43.2 },
    { distance_km: 6, weight_kg: 15, season: 'rainy', fare: 221, fuel_cost: 37.26 }
  ];
  const expenses = [
    { label: 'maintenance (oil change)', amount: 500 },
    { label: 'insurance (monthly)', amount: 1200 }
  ];

  it('reproduces every trip fare from the reference', () => {
    expect(calculateFare({ distance_km: 5, weight_kg: 10, season: 'dry' })).toBe(150);
    expect(calculateFare({ distance_km: 8, weight_kg: 35, season: 'dry' })).toBe(360);
    expect(calculateFare({ distance_km: 6, weight_kg: 15, season: 'rainy' })).toBe(221);
  });

  it('reproduces every fuel cost from the reference', () => {
    expect(calculateFuelCost({ distance_km: 5, season: 'dry' })).toBe(27);
    expect(calculateFuelCost({ distance_km: 8, season: 'dry' })).toBe(43.2);
    expect(calculateFuelCost({ distance_km: 6, season: 'rainy' })).toBe(37.26);
  });

  it('reproduces the published totals: 731 revenue, 1807.46 expenses, -1076.46 profit', () => {
    const result = summarise({ trips, expenses });

    expect(result.total_distance_km).toBe(19);
    expect(result.total_revenue).toBe(731);
    expect(result.fuel_spend).toBe(107.46);
    expect(result.other_expenses).toBe(1700);
    expect(result.total_expenses).toBe(1807.46);
    expect(result.net_profit).toBe(-1076.46);
  });

  it('matches the reference per-trip averages', () => {
    const result = summarise({ trips, expenses });
    expect(result.avg_fare_per_trip).toBe(243.67); // 731 / 3
    expect(result.avg_fare_per_km).toBe(38.47); // 731 / 19
  });

  it('handles an empty ledger without dividing by zero', () => {
    const result = summarise();
    expect(result.trip_count).toBe(0);
    expect(result.total_revenue).toBe(0);
    expect(result.net_profit).toBe(0);
    expect(result.avg_fare_per_km).toBe(0);
  });
});

describe('MySQL DECIMAL strings (regression)', () => {
  // Regression guard: mysql2 returns DECIMAL/NUMERIC columns as JS strings.
  // Uncoerced, `'60.00' + 250` concatenates to '60.00250' and every fare
  // silently collapses to the base fare. These tests fail if that returns.
  const stringRow = {
    base_fare: '60.00',
    rate_per_km: '25.00',
    fuel_price_per_litre: '195.00',
    fuel_consumption_per_km: '0.028'
  };

  it('calculates a fare from string settings', () => {
    // 60 + 10*25 + (25-20)*10 = 360
    expect(calculateFare({ ...stringRow, distance_km: 10, weight_kg: 25 })).toBe(360);
  });

  it('calculates fuel from string settings', () => {
    // 10 * 0.028 * 195 = 54.6
    expect(calculateFuelCost({ ...stringRow, distance_km: 10 })).toBe(54.6);
  });

  it('produces an identical quote for string vs numeric settings', () => {
    const input = { distance_km: 12, weight_kg: 30, season: 'rainy' };
    expect(quoteTrip({ ...stringRow, ...input })).toEqual(quoteTrip({ ...stringRow, ...input }));
    expect(quoteTrip({ ...stringRow, ...input }).fare).toBe(598); // (60+300+100)*1.3
  });

  it('computes break-even from string settings', () => {
    // fuel/km = 0.028*195 = 5.46; margin = 19.54; 60/19.54 = 3.07
    expect(breakEvenDistanceKm(stringRow)).toBe(3.07);
  });

  it('returns numbers from resolveSettings, never strings', () => {
    const resolved = resolveSettings(stringRow);
    Object.values(resolved).forEach((value) => expect(typeof value).toBe('number'));
  });

  it('falls back to defaults for missing settings', () => {
    expect(resolveSettings({}).base_fare).toBe(DEFAULT_RIDER_SETTINGS.base_fare);
  });
});
