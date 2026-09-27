const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();

// Admin-only from this point down.
router.use(authenticate, authorizeRoles('admin'));

router.get('/users', asyncHandler(adminController.listUsers));
router.put('/users/:id/status', asyncHandler(adminController.updateUserStatus));
router.get('/riders/:id/history', asyncHandler(adminController.riderHistory));
router.put('/riders/:id/assign', asyncHandler(adminController.assignRider));

module.exports = router;
