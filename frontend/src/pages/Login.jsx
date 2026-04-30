import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { loginUser } from '../api'
import { useAuth } from '../context/AuthContext'
import Aurora       from '../components/bits/Aurora'
import SpotlightCard from '../components/bits/SpotlightCard'
import StarBorder   from '../components/bits/StarBorder'
import ShinyText    from '../components/bits/ShinyText'
import GradientText from '../components/bits/GradientText'

export default function Login() {
  const navigate        = useNavigate()
  const { login }       = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(cardRef.current,
        { y: 70, opacity: 0, scale: 0.93 },
        { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(1.5)' }
      )
      gsap.fromTo('.auth-field',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.1, delay: 0.4, ease: 'power3.out' }
      )
    })
    return () => ctx.revert()
  }, [])

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { data } = await loginUser(form)
      login(data.user, data.token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-page" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* React Bits Aurora WebGL background */}
      <Aurora
        colorStops={['#001a13', '#00A884', '#001a13']}
        amplitude={0.8}
        blend={0.6}
        speed={0.6}
      />

      {/* Overlay for readability */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(11,20,26,0.72)',
        backdropFilter: 'blur(2px)', pointerEvents: 'none',
      }} />

      {/* React Bits StarBorder wraps SpotlightCard */}
      <div ref={cardRef} style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, margin: '0 24px' }}>
        <StarBorder color="#00A884" speed="8s">
          <SpotlightCard spotlightColor="rgba(0,168,132,0.2)" className="">
            <div style={{ padding: '40px 36px' }}>

              {/* Logo with React Bits GradientText */}
              <div className="auth-field auth-logo">
                <motion.span
                  className="auth-logo-icon"
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 1.6, delay: 1, repeat: Infinity, repeatDelay: 5 }}
                >💬</motion.span>
                <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 4 }}>
                  <GradientText colors={['#00A884', '#4ECDC4', '#00d4aa', '#00A884']} animationSpeed={5}>
                    WhatsApp
                  </GradientText>
                </h1>
                <p className="auth-subtitle">
                  <ShinyText text="Sign in to continue" color="#667781" shineColor="#E9EDEF" speed={4} />
                </p>
              </div>

              <form onSubmit={handleSubmit} className="auth-form" id="login-form">
                <AnimatePresence>
                  {error && (
                    <motion.div className="auth-error" role="alert"
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      transition={{ duration: 0.22 }}
                    >{error}</motion.div>
                  )}
                </AnimatePresence>

                <div className="form-group auth-field">
                  <label htmlFor="email">Email address</label>
                  <input id="email" type="email" name="email" autoComplete="email"
                    placeholder="you@example.com" value={form.email} onChange={handleChange} required />
                </div>

                <div className="form-group auth-field">
                  <label htmlFor="password">Password</label>
                  <input id="password" type="password" name="password" autoComplete="current-password"
                    placeholder="••••••••" value={form.password} onChange={handleChange} required />
                </div>

                <motion.button
                  id="login-btn" type="submit" className="btn-primary auth-field"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.03, boxShadow: '0 0 30px rgba(0,168,132,0.5)' } : {}}
                  whileTap={!loading ? { scale: 0.96 } : {}}
                >
                  {loading ? <span className="btn-spinner" /> : 'Sign In'}
                </motion.button>
              </form>

              <p className="auth-switch auth-field">
                Don't have an account?{' '}
                <Link to="/register" id="go-to-register">Create one</Link>
              </p>
            </div>
          </SpotlightCard>
        </StarBorder>
      </div>
    </div>
  )
}
