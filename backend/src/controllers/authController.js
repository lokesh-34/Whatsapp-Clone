const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { validationResult } = require('express-validator')
const User    = require('../models/User')
const OTP     = require('../models/OTP')
const { sendOtpEmail } = require('../services/emailService')

// ── Helpers ────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })

const generateOtp = () =>
  crypto.randomInt(100000, 999999).toString()  // secure 6-digit OTP

const formatUser = (user) => ({
  _id:         user._id,
  username:    user.username,
  email:       user.email,
  avatarColor: user.avatarColor,
  isOnline:    user.isOnline,
  lastSeen:    user.lastSeen,
  createdAt:   user.createdAt,
})

// ── @route POST /api/auth/send-otp ─────────────────────────
// @access Public  —  Step 1: send 6-digit OTP to email
const sendOtp = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { email } = req.body
    const normalEmail = email.toLowerCase().trim()

    // Don't let someone verify an already-registered email
    const existing = await User.findOne({ email: normalEmail })
    if (existing)
      return res.status(400).json({ success: false, message: 'Email is already registered.' })

    const otp      = generateOtp()
    const expiresAt = new Date(
      Date.now() + (parseInt(process.env.OTP_EXPIRES_MINUTES) || 10) * 60 * 1000
    )

    // Replace any pending OTP for this email
    await OTP.deleteMany({ email: normalEmail })
    await OTP.create({ email: normalEmail, otp, expiresAt })

    // Send email (throws if SMTP fails)
    await sendOtpEmail(normalEmail, otp)

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${normalEmail}`,
    })
  } catch (error) {
    // Provide a friendly SMTP error instead of 500
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      return res.status(500).json({
        success: false,
        message: 'Email service is not configured. Check EMAIL_USER and EMAIL_PASS in .env',
      })
    }
    next(error)
  }
}

// ── @route POST /api/auth/verify-otp ───────────────────────
// @access Public  —  Step 2: verify OTP code
const verifyOtp = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { email, otp } = req.body
    const normalEmail = email.toLowerCase().trim()

    const record = await OTP.findOne({ email: normalEmail })

    if (!record)
      return res.status(400).json({ success: false, message: 'No OTP found for this email. Please request a new one.' })

    if (new Date() > record.expiresAt)
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' })

    if (record.otp !== otp.toString())
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' })

    // Mark as verified so register() can confirm it
    record.verified = true
    await record.save()

    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
    })
  } catch (error) {
    next(error)
  }
}

// ── @route POST /api/auth/register ─────────────────────────
// @access Public  —  Step 3: create account (requires verified OTP)
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { username, email, password } = req.body
    const normalEmail = email.toLowerCase().trim()

    // Ensure OTP was verified
    const otpRecord = await OTP.findOne({ email: normalEmail, verified: true })
    if (!otpRecord)
      return res.status(400).json({
        success: false,
        message: 'Email not verified. Please complete OTP verification first.',
      })

    // Double-check no duplicate user
    const existingUser = await User.findOne({
      $or: [{ email: normalEmail }, { username }],
    })
    if (existingUser) {
      const field = existingUser.email === normalEmail ? 'Email' : 'Username'
      return res.status(400).json({ success: false, message: `${field} is already taken.` })
    }

    const user = await User.create({ username, email: normalEmail, password })

    // Clean up OTP record
    await OTP.deleteMany({ email: normalEmail })

    const token = generateToken(user._id)
    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: formatUser(user),
    })
  } catch (error) {
    next(error)
  }
}

// ── @route POST /api/auth/login ────────────────────────────
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { email, password } = req.body
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')

    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' })

    const token = generateToken(user._id)
    res.status(200).json({ success: true, message: 'Logged in successfully.', token, user: formatUser(user) })
  } catch (error) {
    next(error)
  }
}

// ── @route GET /api/auth/me ────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
    res.status(200).json({ success: true, user })
  } catch (error) {
    next(error)
  }
}

module.exports = { sendOtp, verifyOtp, register, login, getMe }
