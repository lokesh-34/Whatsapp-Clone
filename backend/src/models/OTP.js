const mongoose = require('mongoose')

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  otp: {
    type: String, // stored as plain (short-lived, low-risk) – or hash if preferred
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
