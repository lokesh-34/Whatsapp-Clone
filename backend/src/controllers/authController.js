/**
 * ─── AUTHENTICATION CONTROLLER ───────────────────────────────────────────────
 * Handles the multi-provider authentication logic.
 * 
 * Flow Strategy:
 * - Email: Two-step verification (OTP -> Registration).
 * - Phone: Direct registration (Identifier -> Password).
 * - Social: Federated login via Firebase Google provider.
 * 
 * Security: Uses bcrypt for password hashing and JWT for session management.
 * ──────────────────────────────────────────────────────────────────────────────
 */
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
  phone:       user.phone || null,
  avatarColor: user.avatarColor,
  isOnline:    user.isOnline,
  lastSeen:    user.lastSeen,
  createdAt:   user.createdAt,
})

// ── POST /api/auth/send-otp ──────────────────────────────────
// Used for Email registration. Phone registration is direct.
const sendOtp = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { email } = req.body
    if (!email)
      return res.status(400).json({ success: false, message: 'Email address is required.' })

    const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRES_MINUTES) || 10) * 60 * 1000)
    const otp       = generateOtp()

    const normalEmail = email.toLowerCase().trim()
    const existing = await User.findOne({ email: normalEmail })
    if (existing)
      return res.status(400).json({ success: false, message: 'Email is already registered.' })

    await OTP.deleteMany({ email: normalEmail })
    await OTP.create({ email: normalEmail, otp, expiresAt })
    await sendOtpEmail(normalEmail, otp)

    const devMode = !isEmailConfigured()
    return res.status(200).json({
      success: true,
      devMode,
      message: devMode
        ? '[DEV] OTP logged to backend console — check your terminal'
        : `Verification code sent to ${normalEmail}`,
    })
  } catch (error) {
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
// Accepts { email, otp }
const verifyOtp = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { email, otp } = req.body
    if (!email || !otp)
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' })

    const normalEmail = email.toLowerCase().trim()
    const record = await OTP.findOne({ email: normalEmail })

    if (!record)
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new code.' })

    if (new Date() > record.expiresAt)
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new code.' })

    if (record.otp !== otp.toString())
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' })

    record.verified = true
    await record.save()

    return res.status(200).json({ success: true, message: 'Email verified successfully!' })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/auth/register ──────────────────────────────────
// Standard Email registration path. Requires prior OTP verification.
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { username, email, password } = req.body
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' })

    const normalEmail = email.toLowerCase().trim()
    const otpRecord = await OTP.findOne({ email: normalEmail, verified: true })
    if (!otpRecord)
      return res.status(400).json({ success: false, message: 'Email not verified. Please complete OTP verification first.' })

    // Duplicate check
    const existingUser = await User.findOne({ $or: [{ username }, { email: normalEmail }] })
    if (existingUser) {
      const field = existingUser.email === normalEmail ? 'Email' : 'Username'
      return res.status(400).json({ success: false, message: `${field} is already taken.` })
    }

    const user = await User.create({ username, email: normalEmail, password })
    await OTP.deleteMany({ email: normalEmail })

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
// Accepts { email, password } OR { phone, password }
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { email, phone, password } = req.body
    if (!email && !phone)
      return res.status(400).json({ success: false, message: 'Email or phone number is required.' })

    let user
    if (phone) {
      user = await User.findOne({ phone: phone.trim() }).select('+password')
    } else {
      user = await User.findOne({ email: email.toLowerCase() }).select('+password')
    }

    if (!user || !user.password || !(await user.matchPassword(password)))
      return res.status(401).json({
        success: false,
        message: phone ? 'Invalid phone number or password.' : 'Invalid email or password.',
      })

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

    let user = await User.findOne({ email: normalEmail })
    if (!user) {
      const baseUsername = (name || email.split('@')[0]).replace(/\s+/g, '_').slice(0, 20)
      let username = baseUsername
      let suffix = 1
      while (await User.findOne({ username })) {
        username = `${baseUsername.slice(0, 17)}_${suffix++}`
      }
      user = await User.create({
        username,
        email: normalEmail,
        password: uid + process.env.JWT_SECRET,
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

// ── POST /api/auth/phone-register ───────────────────────────
// Called after Firebase Phone Auth succeeds on the client.
// Expects { idToken, username, password }
const phoneRegister = async (req, res, next) => {
  try {
    const { idToken, username, password } = req.body

    if (!idToken)  return res.status(400).json({ success: false, message: 'Firebase ID token is required.' })
    if (!username) return res.status(400).json({ success: false, message: 'Username is required.' })
    if (!password || password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' })
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim()))
      return res.status(400).json({ success: false, message: 'Username must be 3–20 chars (letters, numbers, underscores).' })

    if (!isFirebaseConfigured())
      return res.status(503).json({ success: false, message: 'Firebase is not configured on the server.' })

    const decoded = await verifyIdToken(idToken)
    if (!decoded)
      return res.status(401).json({ success: false, message: 'Invalid or expired Firebase token. Please try again.' })

    const phone = decoded.phone_number
    if (!phone)
      return res.status(400).json({ success: false, message: 'Token does not contain a verified phone number.' })

    // Duplicate checks
    const existingPhone    = await User.findOne({ phone })
    const existingUsername = await User.findOne({ username: username.trim() })
    if (existingPhone)    return res.status(400).json({ success: false, message: 'This phone number is already registered.' })
    if (existingUsername) return res.status(400).json({ success: false, message: 'Username is already taken.' })

    // Create user — email is required by schema so generate a placeholder
    const user = await User.create({
      username: username.trim(),
      password,
      phone,
      email: `phone_${phone.replace(/\D/g, '')}@placeholder.local`,
    })

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

// ── POST /api/auth/phone-login ────────────────────────────────
// Login with Firebase Phone Auth ID token
const phoneLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body
    if (!idToken) return res.status(400).json({ success: false, message: 'Firebase ID token is required.' })

    if (!isFirebaseConfigured())
      return res.status(503).json({ success: false, message: 'Firebase is not configured on the server.' })

    const decoded = await verifyIdToken(idToken)
    if (!decoded)
      return res.status(401).json({ success: false, message: 'Invalid or expired Firebase token.' })

    const phone = decoded.phone_number
    if (!phone)
      return res.status(400).json({ success: false, message: 'Token does not contain a verified phone number.' })

    const user = await User.findOne({ phone })
    if (!user)
      return res.status(404).json({ success: false, message: 'No account found for this phone number. Please register first.' })

    const token = generateToken(user._id)
    return res.status(200).json({ success: true, message: 'Logged in successfully.', token, user: formatUser(user) })
  } catch (error) {
    next(error)
  }
}

module.exports = { sendOtp, verifyOtp, register, login, getMe, googleLogin, phoneRegister, phoneLogin }
