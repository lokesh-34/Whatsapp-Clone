/**
 * Firebase Admin — initialized only when FIREBASE_PROJECT_ID etc. are set.
 * Falls back to a no-op stub so the server still starts without credentials.
 */
let _admin = null

const isFirebaseConfigured = () =>
  !!(process.env.FIREBASE_PROJECT_ID &&
     process.env.FIREBASE_CLIENT_EMAIL &&
     process.env.FIREBASE_PRIVATE_KEY)

const getAdmin = () => {
  if (_admin) return _admin
  if (!isFirebaseConfigured()) return null

  try {
    const admin = require('firebase-admin')
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      })
    }
    _admin = admin
    return _admin
  } catch (e) {
    console.warn('⚠  firebase-admin init failed:', e.message)
    return null
  }
}

/**
 * Verify a Firebase ID token.
 * Returns the decoded token or null if verification fails / not configured.
 */
const verifyIdToken = async (idToken) => {
  const admin = getAdmin()
  if (!admin) return null
  try {
    return await admin.auth().verifyIdToken(idToken)
  } catch {
    return null
  }
}

module.exports = { isFirebaseConfigured, verifyIdToken, getAdmin }