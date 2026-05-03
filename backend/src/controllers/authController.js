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

const normalizePhone = (phone) => phone.trim()

const buildPhoneEmail = (phone) => {
  const digits = phone.replace(/\D/g, '')
  return `phone_${digits}@phone.local`
}

const ensureUniqueUsername = async (baseUsername) => {
  let username = baseUsername
  let suffix = 1

  while (await User.findOne({ username })) {
    username = `${baseUsername.slice(0, 17)}_${suffix++}`
  }

  return username
}

const createOrLoginPhoneUser = async ({ phone, username }) => {
  const normalPhone = normalizePhone(phone)
  let user = await User.findOne({ phone: normalPhone })

  if (!user) {
    const digits = normalPhone.replace(/\D/g, '')
    const baseUsername = await ensureUniqueUsername((username || `user_${digits.slice(-6) || digits || 'phone'}`).replace(/\s+/g, '_').slice(0, 20))
    user = await User.create({
      username: baseUsername,
      email: buildPhoneEmail(normalPhone),
      phone: normalPhone,
      password: crypto.randomBytes(16).toString('hex'),
    })
  }

  return user
}

// ── POST /api/auth/send-otp ──────────────────────────────────
// Only for Email registration.
const sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ success: false, message: 'Email address is required.' })

    const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRES_MINUTES) || 10) * 60 * 1000)
    const otp       = generateOtp()

    const normalEmail = email.toLowerCase().trim()
    const existing = await User.findOne({ email: normalEmail })
    if (existing) return res.status(400).json({ success: false, message: 'Email is already registered.' })

    await OTP.deleteMany({ email: normalEmail })
    await OTP.create({ email: normalEmail, otp, expiresAt })
    await sendOtpEmail(normalEmail, otp)

    const devMode = !isEmailConfigured()
    return res.status(200).json({
      success: true,
      devMode,
      message: devMode ? '[DEV] Check terminal for OTP' : `OTP sent to ${normalEmail}`
    })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/auth/verify-otp ────────────────────────────────
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required.' })

    const record = await OTP.findOne({ email: email.toLowerCase().trim(), otp: otp.trim() })
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' })
    }

    record.verified = true
    await record.save()
    res.status(200).json({ success: true, message: 'OTP verified.' })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/auth/register ──────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { username, email, phone, password } = req.body

    if (!email && !phone) return res.status(400).json({ success: false, message: 'Email or phone required.' })

    // If email is used, check OTP verification
    if (email) {
      const normalEmail = email.toLowerCase().trim()
      const otpRecord = await OTP.findOne({ email: normalEmail, verified: true })
      if (!otpRecord) return res.status(400).json({ success: false, message: 'Email not verified.' })
      await OTP.deleteMany({ email: normalEmail })
    }

    // Duplicate checks
    const existing = await User.findOne({ 
      $or: [
        { username },
        ...(email ? [{ email: email.toLowerCase().trim() }] : []),
        ...(phone ? [{ phone: phone.trim() }] : [])
      ]
    })
    if (existing) return res.status(400).json({ success: false, message: 'User already exists.' })

    const userData = {
      username,
      password,
      ...(email ? { email: email.toLowerCase().trim() } : {}),
      ...(phone ? { phone: phone.trim() } : {}),
    }

    if (!email && phone) {
      userData.email = `phone_${phone.replace(/\D/g, '')}@placeholder.local`
    }

    const user = await User.create(userData)
    const token = generateToken(user._id)

    res.status(201).json({ success: true, token, user: formatUser(user) })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/auth/login ─────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, phone, password } = req.body
    const user = await User.findOne({ 
      $or: [
        ...(email ? [{ email: email.toLowerCase().trim() }] : []),
        ...(phone ? [{ phone: phone.trim() }] : [])
      ]
    }).select('+password')

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' })
    }

    const token = generateToken(user._id)
    res.status(200).json({ success: true, token, user: formatUser(user) })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/auth/phone-register ────────────────────────────
const phoneRegister = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg })
    }

    if (!isFirebaseConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Firebase Admin is not configured. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
      })
    }

    const { idToken, username } = req.body
    const decoded = await verifyIdToken(idToken)

    if (!decoded || !decoded.phone_number) {
      return res.status(401).json({ success: false, message: 'Invalid or expired Firebase phone token.' })
    }

    const phone = decoded.phone_number.trim()
    const existing = await User.findOne({ phone })
    if (existing) {
      const token = generateToken(existing._id)
      return res.status(200).json({ success: true, message: 'Phone already registered. Logged in successfully.', token, user: formatUser(existing) })
    }

    const user = await createOrLoginPhoneUser({ phone, username })
    const token = generateToken(user._id)
    return res.status(201).json({ success: true, message: 'Phone registered successfully.', token, user: formatUser(user) })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/auth/phone-login ───────────────────────────────
const phoneLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg })
    }

    if (!isFirebaseConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Firebase Admin is not configured. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
      })
    }

    const { idToken } = req.body
    const decoded = await verifyIdToken(idToken)

    if (!decoded || !decoded.phone_number) {
      return res.status(401).json({ success: false, message: 'Invalid or expired Firebase phone token.' })
    }

    const phone = decoded.phone_number.trim()
    const user = await User.findOne({ phone }) || await createOrLoginPhoneUser({ phone })
    const token = generateToken(user._id)

    return res.status(200).json({ success: true, message: 'Signed in with phone successfully.', token, user: formatUser(user) })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/auth/google-login ─────────────────────────────
const googleLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg })
    }

    if (!isFirebaseConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Firebase Admin is not configured. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
      })
    }

    const { idToken } = req.body
    const decoded = await verifyIdToken(idToken)
    if (!decoded || !decoded.email) {
      return res.status(401).json({ success: false, message: 'Invalid or expired Firebase Google token.' })
    }

    const normalEmail = decoded.email.toLowerCase().trim()
    let user = await User.findOne({ email: normalEmail })

    if (!user) {
      const baseUsername = (decoded.name || normalEmail.split('@')[0]).replace(/\s+/g, '_').slice(0, 20)
      const username = await ensureUniqueUsername(baseUsername)

      user = await User.create({
        username,
        email: normalEmail,
        password: crypto.randomBytes(16).toString('hex'),
        googleId: decoded.uid || null,
        avatar: decoded.picture || null,
      })
    }

    const token = generateToken(user._id)
    return res.status(200).json({ success: true, message: 'Signed in with Google successfully.', token, user: formatUser(user) })
  } catch (error) {
    next(error)
  }
}

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
    res.status(200).json({ success: true, user })
  } catch (error) {
    next(error)
  }
}

module.exports = { sendOtp, verifyOtp, register, login, getMe, googleLogin, phoneRegister, phoneLogin }
