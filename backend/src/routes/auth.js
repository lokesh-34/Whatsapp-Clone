const express = require('express')
const { body } = require('express-validator')
const { sendOtp, verifyOtp, register, login, getMe } = require('../controllers/authController')
const { protect } = require('../middlewares/auth')

const router = express.Router()

// ── POST /api/auth/send-otp ─────────────────────────────────
router.post(
  '/send-otp',
  [
    body('email')
      .trim().notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Please enter a valid email address.'),
  ],
  sendOtp
)

// ── POST /api/auth/verify-otp ───────────────────────────────
router.post(
  '/verify-otp',
  [
    body('email').trim().notEmpty().withMessage('Email is required.').isEmail(),
    body('otp')
      .notEmpty().withMessage('OTP is required.')
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits.')
      .isNumeric().withMessage('OTP must be numeric.'),
  ],
  verifyOtp
)

// ── POST /api/auth/register ─────────────────────────────────
router.post(
  '/register',
  [
    body('username')
      .trim().notEmpty().withMessage('Username is required.')
      .isLength({ min: 3, max: 20 }).withMessage('Username must be 3–20 characters.')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores.'),
    body('email')
      .trim().notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Please enter a valid email address.'),
    body('password')
      .notEmpty().withMessage('Password is required.')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  ],
  register
)

// ── POST /api/auth/login ────────────────────────────────────
router.post(
  '/login',
  [
    body('email').trim().notEmpty().withMessage('Email is required.').isEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  login
)

// ── GET /api/auth/me ────────────────────────────────────────
router.get('/me', protect, getMe)

module.exports = router
