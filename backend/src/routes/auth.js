const express = require('express')
const { body } = require('express-validator')
const { sendOtp, verifyOtp, register, login, getMe, googleLogin, phoneRegister, phoneLogin } = require('../controllers/authController')
const { protect } = require('../middlewares/auth')

const router = express.Router()

// Validate phone is E.164 if provided
const phoneValidator = body('phone')
  .optional()
  .trim()
  .matches(/^\+[1-9]\d{6,14}$/)
  .withMessage('Phone must be in E.164 format (e.g. +919876543210)')

// POST /api/auth/send-otp  — accepts email OR phone
router.post(
  '/send-otp',
  [
    body('email').optional().trim().isEmail().withMessage('Valid email required.'),
    phoneValidator,
  ],
  sendOtp
)

// POST /api/auth/verify-otp  — accepts email OR phone + 6-digit otp
router.post(
  '/verify-otp',
  [
    body('email').optional().trim().isEmail(),
    phoneValidator,
    body('otp')
      .notEmpty().withMessage('OTP is required.')
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits.')
      .isNumeric().withMessage('OTP must be numeric.'),
  ],
  verifyOtp
)

// POST /api/auth/register
router.post(
  '/register',
  [
    body('username')
      .trim().notEmpty().withMessage('Username is required.')
      .isLength({ min: 3, max: 20 }).withMessage('Username must be 3–20 characters.')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores.'),
    body('email').optional().trim().isEmail().withMessage('Valid email required.'),
    phoneValidator,
    body('password')
      .notEmpty().withMessage('Password is required.')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  ],
  register
)

// POST /api/auth/login  — accepts email OR phone + password
router.post(
  '/login',
  [
    body('email').optional().trim().isEmail(),
    phoneValidator,
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  login
)

// POST /api/auth/google-login
router.post('/google-login', googleLogin)

// POST /api/auth/phone-register — create account after Firebase Phone Auth OTP verified on client
router.post(
  '/phone-register',
  [
    body('idToken').notEmpty().withMessage('Firebase ID token is required.'),
    body('username')
      .trim().notEmpty().withMessage('Username is required.')
      .isLength({ min: 3, max: 20 }).withMessage('Username must be 3–20 characters.')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Only letters, numbers, and underscores allowed.'),
    body('password').notEmpty().isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  ],
  phoneRegister
)

// POST /api/auth/phone-login — sign in with Firebase Phone Auth ID token
router.post(
  '/phone-login',
  [body('idToken').notEmpty().withMessage('Firebase ID token is required.')],
  phoneLogin
)

// GET /api/auth/me  (protected)
router.get('/me', protect, getMe)

module.exports = router
