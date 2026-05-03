const mongoose = require('mongoose')

const otpSchema = new mongoose.Schema({
  // At least one of email or phone is required (enforced in controller)
  email: {
    type: String,
    default: null,
    lowercase: true,
    trim: true,
    index: true,
    sparse: true,
  },
  phone: {
    type: String,
    default: null,
    trim: true,
    index: true,
    sparse: true,
  },
  otp: {
    type: String, // stored as plain (short-lived, low-risk)
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    // MongoDB TTL index auto-deletes documents 60 s after expiry
    expires: 660,
  },
})

module.exports = mongoose.model('OTP', otpSchema)
