import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { loginUser } from '../api'
import { useAuth } from '../context/AuthContext'
import Aurora from '../components/bits/Aurora'
import GradientText from '../components/bits/GradientText'
import GoogleSignInButton from '../components/auth/GoogleSignInButton'

const looksLikePhone = (val) => /^\+/.test(val.trim())

export default function Login() {
  const navigate  = useNavigate()
  const { login } = useAuth()
  const cardRef   = useRef(null)

  const [identifier, setIdentifier] = useState('')
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)

  const isPhone = looksLikePhone(identifier)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(cardRef.current,
        { y: 70, opacity: 0, scale: 0.93 },
        { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(1.5)' }
      )
    })
    return () => ctx.revert()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    
    try {
      const payload = isPhone 
        ? { phone: identifier.trim(), password }
        : { email: identifier.trim(), password }
        
      const { data } = await loginUser(payload)
      login(data.user, data.token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <Aurora colorStops={['#001a13', '#00A884', '#001a13']} amplitude={0.8} blend={0.55} speed={0.6} />
      <div className="auth-overlay" />

      <div ref={cardRef} className="auth-card-wrap">
        <div className="auth-card">
          <div className="auth-logo">
            <h1 className="auth-title">
              <GradientText colors={['#00A884', '#4ECDC4', '#00d4aa', '#00A884']} animationSpeed={5}>WhatsApp</GradientText>
            </h1>
            <p className="auth-subtitle">Sign in to your account</p>
          </div>

          <GoogleSignInButton label="Continue with Google" />

          <div className="auth-divider">
            <div className="auth-divider-line" />
            <span className="auth-divider-text">or sign in with password</span>
            <div className="auth-divider-line" />
          </div>

          <form onSubmit={handleSubmit} className="auth-form" id="login-form">
            <AnimatePresence>
              {error && (
                <motion.div className="auth-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Email or Mobile number</span>
                {identifier && (
                  <span style={{ fontSize: '10px', color: isPhone ? '#ff9800' : '#4ECDC4', fontWeight: 700 }}>
                    {isPhone ? '📱 PHONE' : '✉️ EMAIL'}
                  </span>
                )}
              </label>
              <input 
                type="text" 
                placeholder="you@example.com or +91XXXXXXXXXX"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setError('') }}
                required 
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                required 
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '10px' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
