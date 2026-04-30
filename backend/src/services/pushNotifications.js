/**
 * Backend push notification service.
 * Firebase Admin is not configured — all calls return { sent: false } gracefully.
 * To enable: install firebase-admin, add FIREBASE_* vars to .env, and restore firebaseAdmin.js
 */
const User = require('../models/User')

const sendPushNotification = async ({ receiver, sender, message }) => {
  // Short-circuit: Firebase not configured
  return { sent: false, reason: 'firebase-not-configured' }
}

module.exports = { sendPushNotification }