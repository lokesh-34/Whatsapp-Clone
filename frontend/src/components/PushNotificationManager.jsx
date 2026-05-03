import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { requestForToken, isFirebaseConfigured } from '../lib/firebase'
import { registerPushToken } from '../api'

/**
 * Handles FCM token registration and listener setup.
 * This component doesn't render anything, just manages side effects.
 */
export default function PushNotificationManager() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user || !isFirebaseConfigured) return

    const setupPush = async () => {
      try {
        // Request permission and get token
        const token = await requestForToken()
        if (token) {
          console.log('FCM Token retrieved:', token)
          // Register token with backend
          await registerPushToken(token)
        }
      } catch (err) {
        console.warn('Push notification setup failed:', err)
      }
    }

    // Delay slightly to not block the main thread during initial render
    const timeout = setTimeout(setupPush, 3000)
    return () => clearTimeout(timeout)
  }, [user])

  return null
}
