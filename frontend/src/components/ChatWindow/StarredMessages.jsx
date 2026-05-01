import { useEffect, useMemo, useState } from 'react'
import { X, Star, Clock, MessageCircle } from 'lucide-react'
import { getStarredMessages } from '../../api'
import e2ee from '../../lib/e2ee'

const getPreview = (type) => {
  if (type === 'voice') return '🎤 Voice message'
  if (type === 'photo' || type === 'camera') return '📷 Photo'
  if (type === 'video') return '🎬 Video'
  if (type === 'document') return '📄 Document'
  if (type === 'location') return '📍 Location'
  if (type === 'emoji') return '😀 Emoji'
  return ''
}

export default function StarredMessages({ open, onClose, currentUser, onOpenChat }) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)
  const currentUserId = currentUser?._id?.toString?.() || currentUser?._id || currentUser?.id

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)

    getStarredMessages()
      .then(async ({ data }) => {
        const messages = data.messages || []
        const hydrated = await Promise.all(messages.map(async (message) => {
          const senderId = (message.sender?._id || message.sender)?.toString?.()
          const receiverId = (message.receiver?._id || message.receiver)?.toString?.()
          const otherUser = senderId === currentUserId ? message.receiver : message.sender

          if (!message.encryptedMessage || !otherUser) {
            return { ...message, otherUser }
          }

          try {
            const content = await e2ee.decryptMessageObject(currentUserId, message, otherUser._id || otherUser)
            return { ...message, content, otherUser }
          } catch {
            return { ...message, content: getPreview(message.messageType) || '[encrypted message]', otherUser }
          }
        }))

        setItems(hydrated)
      })
      .catch((err) => setError(err?.response?.data?.message || err.message || 'Failed to load starred messages'))
      .finally(() => setLoading(false))
  }, [open, currentUserId])

  const groupedItems = useMemo(() => items, [items])

  if (!open) return null

  return (
    <div className="modal-overlay">
      <div className="modal-card starred-list">
        <div className="modal-header">
          <h3>Starred messages</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close starred messages">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {loading && <div className="muted">Loading…</div>}
          {error && <div className="error">{error}</div>}
          {!loading && !groupedItems.length && <div className="muted">No starred messages yet.</div>}

          <ul className="starred-items">
            {groupedItems.map((item) => {
              const otherUser = item.otherUser
              const title = otherUser?.username || 'Unknown contact'
              const time = item.sentAt || item.createdAt

              return (
                <li key={item._id} className="starred-item">
                  <button
                    type="button"
                    className="starred-item-button"
                    onClick={() => {
                      if (otherUser && onOpenChat) onOpenChat(otherUser)
                      onClose?.()
                    }}
                  >
                    <div className="starred-item-icon">
                      <Star size={14} fill="currentColor" />
                    </div>
                    <div className="starred-item-content">
                      <div className="starred-item-top">
                        <strong>{title}</strong>
                        {time && (
                          <span className="starred-item-time"><Clock size={12} /> {new Date(time).toLocaleString()}</span>
                        )}
                      </div>
                      <div className="starred-item-preview">
                        {getPreview(item.messageType) || item.content || '[encrypted message]'}
                      </div>
                    </div>
                    <MessageCircle size={15} className="starred-item-action" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}