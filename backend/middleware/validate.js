const { z } = require('zod');

/**
 * Zod schemas, keyed by the name passed to `validate()`.
 * Validation failures return 400 with a flat list of field errors.
 */
const schemas = {
  register: z.object({
    full_name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
    email: z.string().trim().email('Enter a valid email address.'),
    phone: z.string().trim().optional().or(z.literal('')),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    role: z.enum(['owner', 'rider']).default('rider')
  }),

  login: z.object({
    email: z.string().trim().email('Enter a valid email address.'),
    password: z.string().min(1, 'Password is required.')
  }),

  rider: z.object({
    bike_model: z.string().trim().min(2, 'Bike model is required.'),
    registration_number: z.string().trim().optional().or(z.literal('')),
    base_fare: z.coerce.number().min(0).default(50),
    rate_per_km: z.coerce.number().min(0).default(20),
    fuel_price_per_litre: z.coerce.number().min(0).default(180),
    fuel_consumption_per_km: z.coerce.number().min(0).default(0.03)
  }),

  trip: z.object({
    distance_km: z.coerce.number().positive('Distance must be greater than zero.'),
    weight_kg: z.coerce.number().min(0).max(100, 'A bike cannot carry more than 100kg.').default(0),
    season_key: z.enum(['dry', 'rainy', 'holiday']).default('dry'),
    passenger: z.string().trim().optional().or(z.literal('')),
    notes: z.string().trim().optional().or(z.literal(''))
  }),

  expense: z.object({
    label: z.string().trim().min(2, 'Describe the expense.'),
    amount: z.coerce.number().positive('Amount must be greater than zero.'),
    category: z
      .enum(['maintenance', 'insurance', 'fuel', 'permit', 'equipment', 'other'])
      .default('other')
  }),

  // `rider_id` must be part of the schema: Zod strips unknown keys, so a
  // controller that reads it from req.body would always see undefined.
  quote: z.object({
    rider_id: z.coerce.number().int().positive(),
    distance_km: z.coerce.number().positive(),
    weight_kg: z.coerce.number().min(0).max(100).default(0),
    season_key: z.enum(['dry', 'rainy', 'holiday']).default('dry')
  })
};

/** Express middleware factory: validate('trip') checks req.body. */
function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({ message: `Unknown validation schema "${schemaName}".` });
    }

    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: 'Validation failed.',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      });
    }

    // Replace req.body with the parsed output so defaults and type coercion
    // are applied consistently downstream.
    req.body = result.data;
    return next();
  };
}

module.exports = { validate, schemas };
