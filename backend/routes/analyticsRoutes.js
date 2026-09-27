const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

router.use(authenticate);

router.get('/overview', asyncHandler(analyticsController.overview));
router.get('/riders', asyncHandler(analyticsController.perRider));
router.get('/seasons', asyncHandler(analyticsController.bySeason));
router.get('/break-even', asyncHandler(analyticsController.breakEven));

module.exports = router;
