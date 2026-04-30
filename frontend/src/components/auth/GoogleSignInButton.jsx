import { useState } from 'react'
import { motion } from 'framer-motion'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../../lib/firebase'
import { googleLogin } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function GoogleSignInButton({ label = 'Continue with Google' }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const { login } = useAuth()
  const navigate  = useNavigate()

  if (!isFirebaseConfigured) {
    return (
      <div style={{
        background: 'rgba(255,255,255,.04)', border: '1px dashed #3d5261',
        borderRadius: 10, padding: '10px 14px', textAlign: 'center',
        fontSize: 12, color: '#667781', marginTop: 4,
      }}>
        🔒 Google login needs VITE_FIREBASE_* vars in{' '}
        <code style={{ color: '#8696A0' }}>frontend/.env.local</code>
      </div>
    )
  }

  const handleGoogle = async () => {
    setError(''); setLoading(true)
    try {
      const result  = await signInWithPopup(auth, googleProvider)
      const idToken = await result.user.getIdToken()
      const { data } = await googleLogin(idToken)
      login(data.user, data.token)
      navigate('/')
    } catch (err) {
      let msg = err.response?.data?.message || err.message || 'Google sign-in failed.'
      if (err.response?.status === 503) {
        msg = 'Google login not configured on backend. Use email/password login instead.'
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <motion.button
        id="google-signin-btn"
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        whileHover={!loading ? { scale: 1.02, boxShadow: '0 0 20px rgba(255,255,255,.08)' } : {}}
        whileTap={!loading ? { scale: 0.97 } : {}}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 10, padding: '11px 16px',
          color: '#E9EDEF', fontSize: 14, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all .2s',
        }}
      >
        {loading ? (
          <span className="btn-spinner" style={{ width: 18, height: 18 }} />
        ) : (
          /* Google G SVG */
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.1 29.2 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 29 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 6.1 29 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c4.9 0 9.4-1.9 12.8-4.9l-5.9-5c-1.8 1.3-4 2-6.9 2-5.2 0-9.6-3.5-11.2-8.3l-6.5 5C9.6 40 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l5.9 5C39.9 36 44 30.9 44 25c0-1.3-.1-2.6-.4-3.9z"/>
          </svg>
        )}
        {loading ? 'Signing in…' : label}
      </motion.button>

      {error && (
        <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginTop: 8 }}>{error}</p>
      )}
    </div>
  )
}
