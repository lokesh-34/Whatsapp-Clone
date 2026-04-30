import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Chat from './pages/Chat'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2, ease: 'easeIn' } },
}

const PageWrapper = ({ children }) => (
  <motion.div className="page-wrapper" variants={pageVariants} initial="initial" animate="animate" exit="exit">
    {children}
  </motion.div>
)

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <div className="splash-screen"><div className="splash-logo">💬</div></div>
  return user ? children : <Navigate to="/login" replace />
}

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <div className="splash-screen"><div className="splash-logo">💬</div></div>
  return !user ? children : <Navigate to="/" replace />
}

export default function App() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login"    element={<PublicRoute><PageWrapper><Login /></PageWrapper></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><PageWrapper><Register /></PageWrapper></PublicRoute>} />
        <Route path="/"         element={<ProtectedRoute><PageWrapper><Chat /></PageWrapper></ProtectedRoute>} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
