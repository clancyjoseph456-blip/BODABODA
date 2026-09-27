const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/register', validate('register'), asyncHandler(authController.register));
router.post('/login', validate('login'), asyncHandler(authController.login));
router.get('/me', authenticate, asyncHandler(authController.me));

module.exports = router;
