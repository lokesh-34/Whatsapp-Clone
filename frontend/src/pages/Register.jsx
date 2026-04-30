import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { sendOtp, verifyOtp, registerUser } from '../api'
import { useAuth } from '../context/AuthContext'
import Aurora        from '../components/bits/Aurora'
import SpotlightCard from '../components/bits/SpotlightCard'
import StarBorder    from '../components/bits/StarBorder'
import ShinyText     from '../components/bits/ShinyText'
import GradientText  from '../components/bits/GradientText'

/* ─── Step indicator ──────────────────────────────────────── */
const steps = ['Email', 'Verify OTP', 'Details']

function StepBar({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((label, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Circle */}
            <motion.div
              animate={{
                background: done ? '#00A884' : active ? '#005C4B' : '#2A3942',
                borderColor: done || active ? '#00A884' : '#3d5261',
                scale: active ? 1.12 : 1,
              }}
              transition={{ duration: 0.3 }}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                border: '2px solid',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff',
                flexShrink: 0,
              }}
            >
              {done ? '✓' : i + 1}
            </motion.div>
            {/* Label */}
            <span style={{ fontSize: 11, fontWeight: 600, color: active ? '#00A884' : done ? '#4ECDC4' : '#667781', marginLeft: 6, marginRight: i < steps.length - 1 ? 0 : 0, whiteSpace: 'nowrap' }}>
              {label}
            </span>
            {/* Connector */}
            {i < steps.length - 1 && (
              <motion.div
                animate={{ background: done ? '#00A884' : '#2A3942' }}
                transition={{ duration: 0.4 }}
                style={{ width: 28, height: 2, margin: '0 8px', flexShrink: 0 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── OTP 6-digit input boxes ─────────────────────────────── */
function OtpInput({ value, onChange }) {
  const refs = useRef([])

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      if (!value[i] && i > 0) refs.current[i - 1]?.focus()
      const arr = value.split('')
      arr[i] = ''
      onChange(arr.join(''))
    }
  }

  const handleChange = (i, e) => {
    const ch = e.target.value.replace(/\D/g, '').slice(-1)
    const arr = value.padEnd(6, ' ').split('')
    arr[i] = ch
    const next = arr.join('').trimEnd()
    onChange(next)
    if (ch && i < 5) refs.current[i + 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    refs.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '8px 0 4px' }}>
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = !!value[i]
        return (
          <motion.input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] || ''}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            animate={{
              borderColor: filled ? '#00A884' : '#3d5261',
              boxShadow: filled ? '0 0 0 2px rgba(0,168,132,0.25)' : 'none',
            }}
            style={{
              width: 46, height: 54,
              textAlign: 'center',
              fontSize: 24, fontWeight: 700,
              background: '#111B21',
              border: '2px solid',
              borderRadius: 10,
              color: '#E9EDEF',
              outline: 'none',
              caretColor: '#00A884',
              fontFamily: 'monospace',
            }}
          />
        )
      })}
    </div>
  )
}

/* ─── Countdown resend timer ──────────────────────────────── */
function ResendTimer({ onResend, loading }) {
  const [secs, setSecs] = useState(60)
  const timerRef = useRef(null)

  useEffect(() => {
    setSecs(60)
    timerRef.current = setInterval(() => setSecs(s => { if (s <= 1) { clearInterval(timerRef.current); return 0 } return s - 1 }), 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const handleResend = async () => {
    clearInterval(timerRef.current)
    setSecs(60)
    await onResend()
    timerRef.current = setInterval(() => setSecs(s => { if (s <= 1) { clearInterval(timerRef.current); return 0 } return s - 1 }), 1000)
  }

  return (
    <p style={{ textAlign: 'center', fontSize: 13, color: '#8696A0', marginTop: 12 }}>
      {secs > 0 ? (
        <>Resend code in <strong style={{ color: '#E9EDEF' }}>{secs}s</strong></>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          style={{ background: 'none', border: 'none', color: '#00A884', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}
        >
          Resend OTP
        </button>
      )}
    </p>
  )
}

/* ─── Main Register page ──────────────────────────────────── */
export default function Register() {
  const navigate  = useNavigate()
  const { login } = useAuth()

  const [step,    setStep]    = useState(0)          // 0 email | 1 otp | 2 details
  const [email,   setEmail]   = useState('')
  const [otp,     setOtp]     = useState('')
  const [form,    setForm]    = useState({ username: '', password: '' })
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const cardRef = useRef(null)

  /* GSAP card entrance */
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(cardRef.current,
        { y: 70, opacity: 0, scale: 0.93 },
        { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(1.5)' }
      )
    })
    return () => ctx.revert()
  }, [])

  /* Animate step content on change */
  useEffect(() => {
    gsap.fromTo('.step-content',
      { opacity: 0, x: 30 },
      { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' }
    )
  }, [step])

  /* ── Step 1: Send OTP ─────────────────────────────────── */
  const handleSendOtp = async (e) => {
    e?.preventDefault()
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.'); return
    }
    setError(''); setLoading(true)
    try {
      await sendOtp(email.trim())
      setSuccess(`OTP sent to ${email.trim()}`)
      setOtp('')
      setStep(1)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.')
    } finally { setLoading(false) }
  }

  /* ── Step 2: Verify OTP ───────────────────────────────── */
  const handleVerifyOtp = async (e) => {
    e?.preventDefault()
    if (otp.length !== 6) { setError('Please enter the complete 6-digit code.'); return }
    setError(''); setLoading(true)
    try {
      await verifyOtp(email.trim(), otp)
      setSuccess('Email verified! Create your account below.')
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect OTP. Please try again.')
    } finally { setLoading(false) }
  }

  /* Auto-submit when all 6 digits entered */
  useEffect(() => {
    if (step === 1 && otp.length === 6) handleVerifyOtp()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step])

  /* ── Step 3: Register ─────────────────────────────────── */
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!form.username.trim() || form.username.length < 3) { setError('Username must be at least 3 characters.'); return }
    if (!form.password || form.password.length < 6)        { setError('Password must be at least 6 characters.'); return }
    setError(''); setLoading(true)
    try {
      const { data } = await registerUser({ username: form.username.trim(), email: email.trim(), password: form.password })
      login(data.user, data.token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
      // If OTP expired, go back to step 0
      if (err.response?.data?.message?.includes('verified')) setStep(0)
    } finally { setLoading(false) }
  }

  const stepTitles = ['Verify Email', 'Enter Code', 'Create Account']
  const stepSubs   = ['We\'ll send a 6-digit code to your inbox', `Code sent to ${email || 'your email'}`, 'Almost done — pick a username & password']

  return (
    <div className="auth-page" style={{ position: 'relative', overflow: 'hidden' }}>
      <Aurora colorStops={['#001a13', '#00A884', '#003d2e']} amplitude={0.9} blend={0.55} speed={0.5} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,20,26,0.72)', backdropFilter: 'blur(2px)', pointerEvents: 'none' }} />

      <div ref={cardRef} style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 460, margin: '0 24px' }}>
        <StarBorder color="#00A884" speed="8s">
          <SpotlightCard spotlightColor="rgba(0,168,132,0.18)">
            <div style={{ padding: '36px 36px 32px' }}>

              {/* Logo */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <motion.span
                  style={{ fontSize: 42, display: 'block', marginBottom: 6 }}
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 1.6, delay: 1, repeat: Infinity, repeatDelay: 5 }}
                >💬</motion.span>
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px' }}>
                  <GradientText colors={['#00A884', '#4ECDC4', '#00d4aa', '#00A884']} animationSpeed={5}>
                    WhatsApp
                  </GradientText>
                </h1>
                <p style={{ margin: 0, fontSize: 14 }}>
                  <ShinyText text={stepSubs[step]} color="#667781" shineColor="#E9EDEF" speed={4} />
                </p>
              </div>

              {/* Step Bar */}
              <StepBar current={step} />

              {/* Step title */}
              <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#E9EDEF', textAlign: 'center' }}>
                {stepTitles[step]}
              </h2>

              {/* Alerts */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div key="err" className="auth-error" role="alert"
                    initial={{ opacity: 0, height: 0, y: -6 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    style={{ marginBottom: 16 }}
                  >{error}</motion.div>
                )}
                {success && !error && (
                  <motion.div key="ok"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      background: 'rgba(0,168,132,.12)', border: '1px solid rgba(0,168,132,.3)',
                      color: '#00A884', borderRadius: 8, padding: '10px 14px', fontSize: 13.5, marginBottom: 16,
                    }}
                  >{success}</motion.div>
                )}
              </AnimatePresence>

              {/* ── STEP 0: Email ── */}
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.form key="step0" className="step-content auth-form" id="send-otp-form"
                    onSubmit={handleSendOtp}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.28 }}
                  >
                    <div className="form-group">
                      <label htmlFor="email">Email address</label>
                      <input id="email" type="email" autoComplete="email"
                        placeholder="you@example.com" value={email}
                        onChange={e => { setEmail(e.target.value); setError('') }}
                        required style={{ width: '100%' }}
                      />
                    </div>

                    <motion.button id="send-otp-btn" type="submit" className="btn-primary"
                      disabled={loading}
                      whileHover={!loading ? { scale: 1.03, boxShadow: '0 0 28px rgba(0,168,132,0.45)' } : {}}
                      whileTap={!loading ? { scale: 0.96 } : {}}
                      style={{ marginTop: 4 }}
                    >
                      {loading ? <span className="btn-spinner" /> : 'Send Verification Code →'}
                    </motion.button>
                  </motion.form>
                )}

                {/* ── STEP 1: OTP boxes ── */}
                {step === 1 && (
                  <motion.form key="step1" className="step-content auth-form" id="verify-otp-form"
                    onSubmit={handleVerifyOtp}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.28 }}
                  >
                    <p style={{ textAlign: 'center', fontSize: 13.5, color: '#8696A0', margin: '0 0 16px', lineHeight: 1.5 }}>
                      Enter the 6-digit code sent to<br />
                      <strong style={{ color: '#E9EDEF' }}>{email}</strong>
                    </p>

                    <OtpInput value={otp} onChange={v => { setOtp(v); setError('') }} />

                    <ResendTimer onResend={handleSendOtp} loading={loading} />

                    <motion.button id="verify-otp-btn" type="submit" className="btn-primary"
                      disabled={loading || otp.length < 6}
                      whileHover={otp.length === 6 && !loading ? { scale: 1.03, boxShadow: '0 0 28px rgba(0,168,132,0.45)' } : {}}
                      whileTap={otp.length === 6 && !loading ? { scale: 0.96 } : {}}
                      style={{ marginTop: 8 }}
                    >
                      {loading ? <span className="btn-spinner" /> : 'Verify Code →'}
                    </motion.button>

                    <button type="button"
                      onClick={() => { setStep(0); setOtp(''); setError(''); setSuccess('') }}
                      style={{ background: 'none', border: 'none', color: '#8696A0', fontSize: 13, cursor: 'pointer', textAlign: 'center', marginTop: 8, width: '100%' }}
                    >
                      ← Change email
                    </button>
                  </motion.form>
                )}

                {/* ── STEP 2: Username + Password ── */}
                {step === 2 && (
                  <motion.form key="step2" className="step-content auth-form" id="register-form"
                    onSubmit={handleRegister}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.28 }}
                  >
                    <div className="form-group">
                      <label htmlFor="username">Username</label>
                      <input id="username" type="text" autoComplete="username"
                        placeholder="john_doe" value={form.username}
                        onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setError('') }}
                        required minLength={3} maxLength={20}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="reg-password">Password</label>
                      <input id="reg-password" type="password" autoComplete="new-password"
                        placeholder="Min. 6 characters" value={form.password}
                        onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError('') }}
                        required minLength={6}
                      />
                    </div>

                    <motion.button id="register-btn" type="submit" className="btn-primary"
                      disabled={loading}
                      whileHover={!loading ? { scale: 1.03, boxShadow: '0 0 28px rgba(0,168,132,0.45)' } : {}}
                      whileTap={!loading ? { scale: 0.96 } : {}}
                      style={{ marginTop: 4 }}
                    >
                      {loading ? <span className="btn-spinner" /> : 'Create Account 🎉'}
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>

              <p className="auth-switch" style={{ marginTop: 20 }}>
                Already have an account?{' '}
                <Link to="/login" id="go-to-login">Sign in</Link>
              </p>
            </div>
          </SpotlightCard>
        </StarBorder>
      </div>
    </div>
  )
}
