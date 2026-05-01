import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send } from 'lucide-react'

export default function ForwardDialog({ message, open, onClose, onForward, currentUser, allUsers = [] }) {
  const [selectedUsers, setSelectedUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (!open) {
      setSelectedUsers([])
      setSearchTerm('')
      setError('')
    }
  }, [open])

  // Filter users based on search term (exclude current user)
  useEffect(() => {
    let filtered = allUsers.filter(
      (u) => u._id !== currentUser?._id && 
      u.username.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setUsers(filtered)
  }, [searchTerm, allUsers, currentUser])

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) 
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const handleForward = async () => {
    if (selectedUsers.length === 0) {
      setError('Select at least one recipient')
      return
    }

    setLoading(true)
    setError('')

    try {
      // For now, forward to each user sequentially
      for (const userId of selectedUsers) {
        await onForward(userId, message)
      }
      setSelectedUsers([])
      setSearchTerm('')
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to forward message')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="forward-dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="forward-dialog"
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="forward-dialog-header">
              <h2>Forward to</h2>
              <button className="forward-dialog-close" onClick={onClose} title="Close">
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="forward-dialog-search">
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="forward-search-input"
              />
            </div>

            {/* User List */}
            <div className="forward-dialog-list">
              {users.length > 0 ? (
                users.map((user) => (
                  <div
                    key={user._id}
                    className={`forward-user-item ${selectedUsers.includes(user._id) ? 'selected' : ''}`}
                    onClick={() => toggleUserSelection(user._id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user._id)}
                      onChange={() => toggleUserSelection(user._id)}
                      className="forward-checkbox"
                    />
                    <div
                      className="forward-user-avatar"
                      style={{ background: user.avatarColor }}
                    >
                      {user.username[0].toUpperCase()}
                    </div>
                    <span className="forward-user-name">{user.username}</span>
                  </div>
                ))
              ) : (
                <div className="forward-no-users">
                  {searchTerm ? 'No users found' : 'No contacts available'}
                </div>
              )}
            </div>

            {/* Error */}
            {error && <div className="forward-error">{error}</div>}

            {/* Actions */}
            <div className="forward-dialog-actions">
              <button 
                className="forward-cancel-btn" 
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="forward-send-btn"
                onClick={handleForward}
                disabled={loading || selectedUsers.length === 0}
              >
                <Send size={16} />
                {loading ? 'Forwarding...' : `Forward (${selectedUsers.length})`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
