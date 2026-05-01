import { useEffect, useState } from 'react'
import { X, Trash, Clock } from 'lucide-react'
import { getScheduledMessages, cancelScheduledMessage } from '../../api'

export default function ScheduledList({ open, onClose, userId, onCancelled }) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !userId) return
    setLoading(true); setError(null)
    getScheduledMessages(userId)
      .then(({ data }) => setItems(data.messages || []))
      .catch(err => setError(err?.response?.data?.message || err.message))
      .finally(() => setLoading(false))
  }, [open, userId])

  const handleCancel = async (id) => {
    const prev = items
    setItems(items.filter(i => i._id !== id))
    try {
      await cancelScheduledMessage(id)
      onCancelled && onCancelled(id)
    } catch (err) {
      setItems(prev)
      console.error('Cancel failed', err)
      setError('Failed to cancel scheduled message')
    }
  }

  if (!open) return null

  return (
    <div className="modal-overlay">
      <div className="modal-card scheduled-list">
        <div className="modal-header">
          <h3>Scheduled messages</h3>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {loading && <div className="muted">Loading…</div>}
          {error && <div className="error">{error}</div>}
          {!loading && !items.length && <div className="muted">No scheduled messages.</div>}
          <ul className="scheduled-items">
            {items.map(item => (
              <li key={item._id} className="scheduled-item">
                <div className="left">
                  <div className="meta"><Clock size={14} /> {new Date(item.scheduledFor).toLocaleString()}</div>
                  <div className="content">{item.messageType === 'voice' ? '🎤 Voice message' : (item.messageType === 'emoji' ? item.encryptedMessage : '🔒 Encrypted')}</div>
                </div>
                <div className="actions">
                  <button className="cancel-btn" title="Cancel" onClick={() => handleCancel(item._id)}><Trash size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
