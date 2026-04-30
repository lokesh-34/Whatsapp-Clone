import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(localStorage.getItem('wa_token') || null)
  const [loading, setLoading] = useState(true)

  // On mount: verify token and fetch current user
  useEffect(() => {
    const verify = async () => {
      if (!token) { setLoading(false); return }
      try {
        const { data } = await getMe()
        setUser(data.user)
      } catch {
        // Token invalid or expired
        localStorage.removeItem('wa_token')
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [token])

  const login = (userData, jwtToken) => {
    localStorage.setItem('wa_token', jwtToken)
    setToken(jwtToken)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('wa_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
