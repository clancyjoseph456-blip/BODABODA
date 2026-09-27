const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const riderController = require('../controllers/riderController');
const tripController = require('../controllers/tripController');
const expenseController = require('../controllers/expenseController');

const router = express.Router();

// Every route below requires a live session.
router.use(authenticate);

/** Price a trip without saving it. Declared before /:id to avoid a name clash. */
router.post('/quote', validate('quote'), asyncHandler(tripController.quote));

/** All riders the caller is allowed to see. */
router.get('/', asyncHandler(riderController.listRiders));
router.post('/', validate('rider'), asyncHandler(riderController.createRider));

/** Single rider + its owner. */
router.get('/:id', asyncHandler(riderController.getRider));
router.put('/:id', validate('rider'), asyncHandler(riderController.updateRider));
router.delete('/:id', asyncHandler(riderController.deleteRider));
router.get('/:id/summary', asyncHandler(riderController.getSummary));

/** Trips. Creation prices server-side; the client never supplies fare. */
router.get('/:riderId/trips', asyncHandler(tripController.listTrips));
router.post('/:riderId/trips', validate('trip'), asyncHandler(tripController.createTrip));
router.get('/:riderId/trips/:id', asyncHandler(tripController.getTrip));
router.delete('/:riderId/trips/:id', asyncHandler(tripController.deleteTrip));

/** Manual expenses. Fuel is booked automatically by trip creation. */
router.get('/:riderId/expenses', asyncHandler(expenseController.listExpenses));
router.post('/:riderId/expenses', validate('expense'), asyncHandler(expenseController.createExpense));
router.delete('/:riderId/expenses/:id', asyncHandler(expenseController.deleteExpense));

module.exports = router;
