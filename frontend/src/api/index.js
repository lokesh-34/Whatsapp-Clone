import axios from 'axios'

const API = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('wa_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auth ─────────────────────────────────────────────────────
export const sendOtp      = (email)           => API.post('/auth/send-otp',     { email })
export const verifyOtp    = (email, otp)      => API.post('/auth/verify-otp',   { email, otp })
export const registerUser = (data)            => API.post('/auth/register',     data)
export const loginUser    = (data)            => API.post('/auth/login',        data)
export const googleLogin  = (idToken)         => API.post('/auth/google-login', { idToken })
export const getMe        = ()                => API.get('/auth/me')

// ── Users ────────────────────────────────────────────────────
export const searchUsers  = (q)               => API.get(`/users/search?q=${encodeURIComponent(q)}`)
export const getUsers     = ()                => API.get('/users')
export const getUserById  = (id)              => API.get(`/users/${id}`)

// ── Messages ─────────────────────────────────────────────────
export const getConversations = ()               => API.get('/messages/conversations')
export const getMessages      = (userId)         => API.get(`/messages/${userId}`)
export const sendMessage      = (userId, payload) => API.post(`/messages/${userId}`, payload)
export const getUnread        = ()               => API.get('/messages/unread')
export const getScheduledMessages = (userId)    => API.get(`/messages/${userId}/scheduled`)
export const cancelScheduledMessage = (messageId) => API.delete(`/messages/scheduled/${messageId}`)
export const editMessage = (messageId, payload) => API.put(`/messages/${messageId}/edit`, payload)

// ── E2EE public key exchange ─────────────────────────────────
export const getPublicKey     = (userId)         => API.get(`/users/public-key/${userId}`)
export const postPublicKey    = (publicKey)      => API.post('/users/public-key', { publicKey })

export default API
