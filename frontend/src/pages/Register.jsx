import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { registerUser, sendOtp, verifyOtp } from '../api'
import { useAuth } from '../context/AuthContext'
import Aurora from '../components/bits/Aurora'
import GradientText from '../components/bits/GradientText'
import GoogleSignInButton from '../components/auth/GoogleSignInButton'

// ── Helpers ───────────────────────────────────────────────────
const isPhone      = (val) => /^\+/.test(val.trim())
const isValidEmail = (val) => /\S+@\S+\.\S+/.test(val.trim())
const isValidPhone = (val) => /^\+[1-9]\d{6,14}$/.test(val.trim())

export default function Register() {
  const navigate  = useNavigate()
  const { login } = useAuth()

  // Form State
  const [step,      setStep]      = useState(0) // 0: Contact, 1: Verify (Email only), 2: Details
  const [contact,   setContact]   = useState('')
  const [otp,       setOtp]       = useState('')
  const [form,      setForm]      = useState({ username: '', password: '' })
  
  const [error,     setError]     = useState('')
  const [info,      setInfo]      = useState('')
  const [loading,   setLoading]   = useState(false)
  const [devMode,   setDevMode]   = useState(false)

  const cardRef = useRef(null)

  // Derived
  const usingPhone = isPhone(contact)

  /* GSAP entrance */
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(cardRef.current,
        { y: 70, opacity: 0, scale: 0.93 },
        { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(1.5)' }
      )
    })
    return () => ctx.revert()
  }, [])

  /* ── Step 0: Initial Submit ── */
  const handleInitialSubmit = async (e) => {
    e.preventDefault()
    const val = contact.trim()

    if (usingPhone) {
      // 📱 PHONE FLOW: No OTP. Just validate format and go to Details.
      if (!isValidPhone(val)) {
        setError('Enter a valid phone in E.164 format, e.g. +919876543210'); return
      }
      setError(''); setInfo('')
      setStep(2) // Skip OTP step entirely for phone
    } else {
      // ✉️ EMAIL FLOW: Requires OTP verification
      if (!isValidEmail(val)) {
        setError('Please enter a valid email address.'); return
      }
      setError(''); setInfo(''); setLoading(true)
      try {
        const { data } = await sendOtp({ email: val })
        setDevMode(!!data.devMode)
        setInfo(data.message)
        setStep(1)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to send OTP.')
      } finally { setLoading(false) }
    }
  }

  /* ── Step 1: Verify Email OTP ── */
  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) { setError('Enter 6-digit code.'); return }
    setError(''); setLoading(true)
    try {
      await verifyOtp({ email: contact.trim(), otp })
      setStep(2)
      setInfo('Email verified!')
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect OTP.')
    } finally { setLoading(false) }
  }

  /* ── Step 2: Final Register ── */
  const handleRegister = async (e) => {
    e.preventDefault()
    if (form.username.trim().length < 3) { setError('Username min 3 chars.'); return }
    if (form.password.length < 6)        { setError('Password min 6 chars.'); return }
    
    setError(''); setLoading(true)
    try {
      const payload = {
        username: form.username.trim(),
        password: form.password,
        ...(usingPhone ? { phone: contact.trim() } : { email: contact.trim() })
      }
      const { data } = await registerUser(payload)
      login(data.user, data.token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <Aurora colorStops={['#001a13', '#00A884', '#003d2e']} amplitude={0.9} blend={0.55} speed={0.5} />
      <div className="auth-overlay" />

      <div ref={cardRef} className="auth-card-wrap" style={{ maxWidth: 460 }}>
        <div className="auth-card">
          {/* Logo */}
          <div className="auth-logo">
            <h1 className="auth-title">
              <GradientText colors={['#00A884', '#4ECDC4', '#00d4aa', '#00A884']} animationSpeed={5}>WhatsApp</GradientText>
            </h1>
            <p className="auth-subtitle">
              {step === 2 ? 'Complete your profile' : 'Create an account to get started'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div key="err" className="auth-error" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                {error}
              </motion.div>
            )}
            {info && !error && (
              <motion.div key="info" className="auth-info" style={{ background: 'rgba(0,168,132,.1)', border: '1px solid #00A884', color: '#00A884', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '15px' }}>
                {info}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* Step 0: Contact Input */}
            {step === 0 && (
              <motion.form key="s0" className="auth-form" onSubmit={handleInitialSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="form-group">
                  <label>Email or Mobile number</label>
                  <input
                    type="text"
                    placeholder="you@example.com or +91XXXXXXXXXX"
                    value={contact}
                    onChange={e => { setContact(e.target.value); setError('') }}
                    required
                  />
                  {usingPhone && <p style={{ fontSize: '11px', color: '#8696A0', marginTop: '5px' }}>📱 Direct registration via phone (No OTP required)</p>}
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Processing...' : 'Continue →'}
                </button>
                <div className="auth-divider" style={{ margin: '14px 0 10px' }}>
                  <div className="auth-divider-line" />
                  <span className="auth-divider-text">or</span>
                  <div className="auth-divider-line" />
                </div>
                <GoogleSignInButton label="Sign up with Google" />
              </motion.form>
            )}

            {/* Step 1: Email OTP (Only for email) */}
            {step === 1 && (
              <motion.form key="s1" className="auth-form" onSubmit={handleVerifyEmailOtp} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="form-group">
                  <label>Enter 6-digit code sent to {contact}</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError('') }}
                    style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>Verify & Continue</button>
                <button type="button" className="btn-link" onClick={() => setStep(0)} style={{ width: '100%', marginTop: '10px' }}>← Change Email</button>
              </motion.form>
            )}

            {/* Step 2: Final Details */}
            {step === 2 && (
              <motion.form key="s2" className="auth-form" onSubmit={handleRegister} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="john_doe"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Min. 6 characters"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Account 🎉'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="auth-switch" style={{ marginTop: 24 }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
