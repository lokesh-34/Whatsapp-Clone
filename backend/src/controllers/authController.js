const jwt    = require('jsonwebtoken')
const crypto = require('crypto')
const { validationResult } = require('express-validator')
const User  = require('../models/User')
const OTP   = require('../models/OTP')
const { sendOtpEmail, isEmailConfigured } = require('../services/emailService')
const { verifyIdToken, isFirebaseConfigured } = require('../config/firebaseAdmin')

// ── Helpers ──────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })

const generateOtp = () => crypto.randomInt(100000, 999999).toString()

const formatUser = (user) => ({
  _id:         user._id,
  username:    user.username,
  email:       user.email,
  avatarColor: user.avatarColor,
  isOnline:    user.isOnline,
  lastSeen:    user.lastSeen,
  createdAt:   user.createdAt,
})

// ── POST /api/auth/send-otp ──────────────────────────────────
// Step 1: generate OTP and email it (or log in dev mode)
const sendOtp = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { email } = req.body
    const normalEmail = email.toLowerCase().trim()

    // Block already-registered emails
    const existing = await User.findOne({ email: normalEmail })
    if (existing)
      return res.status(400).json({ success: false, message: 'Email is already registered.' })

    const otp       = generateOtp()
    const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRES_MINUTES) || 10) * 60 * 1000)

    // Replace any existing OTP for this email
    await OTP.deleteMany({ email: normalEmail })
    await OTP.create({ email: normalEmail, otp, expiresAt })

    // Send email — in dev mode without credentials, logs OTP to console
    await sendOtpEmail(normalEmail, otp)

    const devMode = !isEmailConfigured()

    return res.status(200).json({
      success: true,
      devMode,
      message: devMode
        ? `[DEV] OTP logged to backend console — check your terminal`
        : `Verification code sent to ${normalEmail}`,
    })
  } catch (error) {
    // SMTP auth failure — friendly message
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      return res.status(500).json({
        success: false,
        message: 'Gmail SMTP auth failed. Set correct EMAIL_USER and EMAIL_PASS in backend/.env',
      })
    }
    next(error)
  }
}

// ── POST /api/auth/verify-otp ────────────────────────────────
// Step 2: verify the 6-digit code
const verifyOtp = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { email, otp } = req.body
    const normalEmail    = email.toLowerCase().trim()

    const record = await OTP.findOne({ email: normalEmail })

    if (!record)
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new code.' })

    if (new Date() > record.expiresAt)
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new code.' })

    if (record.otp !== otp.toString())
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' })

    // Mark verified so register() can proceed
    record.verified = true
    await record.save()

    return res.status(200).json({ success: true, message: 'Email verified successfully!' })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/auth/register ──────────────────────────────────
// Step 3: create account — requires prior OTP verification
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { username, email, password } = req.body
    const normalEmail = email.toLowerCase().trim()

    // Must have a verified OTP record
    const otpRecord = await OTP.findOne({ email: normalEmail, verified: true })
    if (!otpRecord)
      return res.status(400).json({
        success: false,
        message: 'Email not verified. Please complete OTP verification first.',
      })

    // Duplicate check
    const existingUser = await User.findOne({ $or: [{ email: normalEmail }, { username }] })
    if (existingUser) {
      const field = existingUser.email === normalEmail ? 'Email' : 'Username'
      return res.status(400).json({ success: false, message: `${field} is already taken.` })
    }

    const user = await User.create({ username, email: normalEmail, password })
    await OTP.deleteMany({ email: normalEmail })  // clean up

    const token = generateToken(user._id)
    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: formatUser(user),
    })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/auth/login ─────────────────────────────────────
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
    return res.status(200).json({ success: true, message: 'Logged in successfully.', token, user: formatUser(user) })
  } catch (error) {
    next(error)
  }
}

// ── GET /api/auth/me ─────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
    res.status(200).json({ success: true, user })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/auth/google-login ─────────────────────────────
// Verifies a Firebase ID token and signs in / auto-registers the user
const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body
    if (!idToken) return res.status(400).json({ success: false, message: 'Firebase ID token is required.' })

    if (!isFirebaseConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Google login is not configured. Add FIREBASE_* vars to backend/.env',
      })
    }

    const decoded = await verifyIdToken(idToken)
    if (!decoded) return res.status(401).json({ success: false, message: 'Invalid or expired Google token.' })

    const { email, name, picture, uid } = decoded
    const normalEmail = email.toLowerCase().trim()

    // Find or create user
    let user = await User.findOne({ email: normalEmail })
    if (!user) {
      // Auto-register: derive username from name or email prefix
      const baseUsername = (name || email.split('@')[0]).replace(/\s+/g, '_').slice(0, 20)
      let username = baseUsername
      let suffix = 1
      while (await User.findOne({ username })) {
        username = `${baseUsername.slice(0, 17)}_${suffix++}`
      }
      user = await User.create({
        username,
        email: normalEmail,
        password: uid + process.env.JWT_SECRET, // non-guessable, never used for password login
        googleId: uid,
        avatar: picture || null,
      })
    }

    const token = generateToken(user._id)
    return res.status(200).json({ success: true, message: 'Signed in with Google.', token, user: formatUser(user) })
  } catch (error) {
    next(error)
  }
}

module.exports = { sendOtp, verifyOtp, register, login, getMe, googleLogin }
