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
export const sendOtp        = (payload)         => API.post('/auth/send-otp',        payload)
export const verifyOtp      = (payload)         => API.post('/auth/verify-otp',      payload)
export const registerUser   = (data)            => API.post('/auth/register',        data)
export const loginUser      = (data)            => API.post('/auth/login',           data)
export const googleLogin    = (idToken)         => API.post('/auth/google-login',    { idToken })
export const phoneRegister  = (data)            => API.post('/auth/phone-register',  data)  // { idToken, username, password }
export const phoneLogin     = (idToken)         => API.post('/auth/phone-login',     { idToken })
export const getMe          = ()                => API.get('/auth/me')

// ── Users ────────────────────────────────────────────────────
export const searchUsers  = (q)               => API.get(`/users/search?q=${encodeURIComponent(q)}`)
export const getUsers     = ()                => API.get('/users')
export const getUserById  = (id)              => API.get(`/users/${id}`)

// ── Messages ─────────────────────────────────────────────────
export const getConversations = ()               => API.get('/messages/conversations')
export const getMessages      = (userId)         => API.get(`/messages/${userId}`)
export const sendMessage      = (userId, payload) => API.post(`/messages/${userId}`, payload)
export const getUnread        = ()               => API.get('/messages/unread')
export const getStarredMessages = ()             => API.get('/messages/starred')
export const getScheduledMessages = (userId)    => API.get(`/messages/${userId}/scheduled`)
export const cancelScheduledMessage = (messageId) => API.delete(`/messages/scheduled/${messageId}`)
export const editMessage = (messageId, payload) => API.put(`/messages/${messageId}/edit`, payload)
export const forwardMessage = (messageId, payload) => API.post(`/messages/${messageId}/forward`, payload)
export const togglePinMessage = (messageId) => API.patch(`/messages/${messageId}/pin`)
export const toggleStarMessage = (messageId) => API.patch(`/messages/${messageId}/star`)
export const deleteMessage = (messageId, payload = {}) => API.delete(`/messages/${messageId}`, { data: payload })

// ── Groups ───────────────────────────────────────────────────
export const getGroups = ()                    => API.get('/groups')
export const getGroupById = (groupId)          => API.get(`/groups/${groupId}`)
export const createGroup = (payload)           => API.post('/groups', payload)
export const renameGroup = (groupId, payload)  => API.patch(`/groups/${groupId}`, payload)
export const addGroupMembers = (groupId, payload) => API.post(`/groups/${groupId}/members`, payload)
export const removeGroupMembers = (groupId, payload) => API.delete(`/groups/${groupId}/members`, { data: payload })
export const removeGroupMember = (groupId, memberId) => API.delete(`/groups/${groupId}/members/${memberId}`)
export const getGroupMessages = (groupId)      => API.get(`/groups/${groupId}/messages`)
export const sendGroupMessage = (groupId, payload) => API.post(`/groups/${groupId}/messages`, payload)

// ── E2EE public key exchange ─────────────────────────────────
export const getPublicKey     = (userId)         => API.get(`/users/public-key/${userId}`)
export const postPublicKey    = (publicKey)      => API.post('/users/public-key', { publicKey })

// ── Conversation Preferences ────────────────────────────────
export const togglePinConversation = (userId)  => API.patch(`/users/pin-conversation/${userId}`)
export const toggleStarConversation = (userId) => API.patch(`/users/star-conversation/${userId}`)
export const markConversationRead = (userId)   => API.patch(`/users/mark-conversation-read/${userId}`)

export default API
