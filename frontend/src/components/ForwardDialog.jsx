import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Search } from 'lucide-react'

export default function ForwardDialog({ message, open, onClose, onForward, currentUser, allUsers = [], inline = false }) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setSelectedUserId('')
      setSearchTerm('')
      setError('')
    }
  }, [open])

  const users = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return allUsers.filter((u) => {
      if (u._id === currentUser?._id) return false
      if (!term) return true
      return (u.username || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term)
    })
  }, [allUsers, currentUser, searchTerm])

  const handleForward = async () => {
    if (!selectedUserId) {
      setError('Select a recipient')
      return
    }

    setLoading(true)
    setError('')

    try {
      const selectedUser = users.find((user) => user._id === selectedUserId)
      if (!selectedUser) throw new Error('Recipient not found')
      await onForward(selectedUser, message)
      setSelectedUserId('')
      setSearchTerm('')
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to forward message')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const content = (
    <motion.div
      className="forward-picker"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="forward-picker-header">
        <div>
          <h2>Forward to</h2>
          <p>Select a person in chat to send this message.</p>
        </div>
        <button className="forward-dialog-close" onClick={onClose} title="Close">
          <X size={20} />
        </button>
      </div>

      <div className="forward-dialog-search">
        <Search size={16} className="forward-search-icon" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="forward-search-input"
        />
      </div>

      <div className="forward-picker-list">
        {users.length > 0 ? users.map((user) => (
          <button
            key={user._id}
            type="button"
            className={`forward-user-item ${selectedUserId === user._id ? 'selected' : ''}`}
            onClick={() => setSelectedUserId(user._id)}
          >
            <div className="forward-user-avatar" style={{ background: user.avatarColor }}>
              {user.username[0].toUpperCase()}
            </div>
            <span className="forward-user-name">{user.username}</span>
          </button>
        )) : (
          <div className="forward-no-users">
            {searchTerm ? 'No users found' : 'No contacts available'}
          </div>
        )}
      </div>

      {error && <div className="forward-error">{error}</div>}

      <div className="forward-dialog-actions">
        <button className="forward-cancel-btn" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button className="forward-send-btn" onClick={handleForward} disabled={loading || !selectedUserId}>
          <Send size={16} />
          {loading ? 'Forwarding...' : 'Forward'}
        </button>
      </div>
    </motion.div>
  )

  if (inline) return content

  return (
    <AnimatePresence>
      {content}
    </AnimatePresence>
  )
}
