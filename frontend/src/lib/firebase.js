import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured =
  !!(firebaseConfig.apiKey && firebaseConfig.projectId)

export const firebaseApp = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

// Auth — used for Google Sign-In
export const auth           = isFirebaseConfigured ? getAuth(firebaseApp) : null
export const googleProvider = isFirebaseConfigured ? new GoogleAuthProvider() : null

// Messaging — for Push Notifications
export const messaging = isFirebaseConfigured ? getMessaging(firebaseApp) : null

/**
 * Request notification permission and get FCM token
 */
export const requestForToken = async () => {
  if (!messaging) return null
  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY, // Needs to be generated in Firebase Console
      })
      if (token) return token
      console.warn('No registration token available. Request permission to generate one.')
    }
  } catch (err) {
    console.error('An error occurred while retrieving token:', err)
  }
  return null
}

export { onMessage, firebaseConfig }