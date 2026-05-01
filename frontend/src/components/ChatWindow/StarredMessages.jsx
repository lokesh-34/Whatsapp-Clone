import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Search, Star, Clock, ChevronRight } from 'lucide-react'
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
  const [query, setQuery] = useState('')
  const currentUserId = currentUser?._id?.toString?.() || currentUser?._id || currentUser?.id

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setQuery('')

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

  const groupedItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (!query.trim()) return true
      const haystack = [
        item.otherUser?.username,
        item.otherUser?.email,
        item.content,
        getPreview(item.messageType),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(query.toLowerCase().trim())
    })

    const groups = new Map()
    filtered.forEach((item) => {
      const otherUser = item.otherUser
      const key = otherUser?._id?.toString?.() || otherUser?.id || 'unknown'
      if (!groups.has(key)) {
        groups.set(key, {
          otherUser,
          messages: [],
          latestTime: 0,
        })
      }
      const group = groups.get(key)
      group.messages.push(item)
      const timeValue = new Date(item.sentAt || item.createdAt || 0).getTime()
      if (timeValue > group.latestTime) group.latestTime = timeValue
    })

    return Array.from(groups.values()).sort((a, b) => b.latestTime - a.latestTime)
  }, [items, query])

  const formatGroupDate = (timestamp) => {
    if (!timestamp) return ''
    return new Date(timestamp).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return ''
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!open) return null

  return (
    <div className="starred-screen">
      <div className="starred-screen-header">
        <button type="button" className="starred-back-btn" onClick={onClose} aria-label="Back to chat">
          <ArrowLeft size={22} />
        </button>
        <div className="starred-screen-title-wrap">
          <h3>Starred messages</h3>
        </div>
        <button type="button" className="starred-menu-btn" aria-label="More options">
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className="starred-screen-search">
        <Search size={18} className="starred-search-icon" />
        <input
          type="text"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="starred-search-input"
        />
      </div>

      <div className="starred-screen-body">
        {loading && <div className="starred-empty">Loading…</div>}
        {error && <div className="starred-empty starred-empty--error">{error}</div>}
        {!loading && !error && !groupedItems.length && <div className="starred-empty">No starred messages yet.</div>}

        {!loading && !error && groupedItems.map((group) => {
          const otherUser = group.otherUser
          const latestMessage = group.messages[0]
          const title = otherUser?.username || otherUser?.email || 'Unknown contact'
          const dateLabel = formatGroupDate(group.latestTime)
          const previewText = getPreview(latestMessage.messageType) || latestMessage.content || '[encrypted message]'

          return (
            <section key={otherUser?._id || title} className="starred-thread-card">
              <button
                type="button"
                className="starred-thread-header"
                onClick={() => {
                  if (otherUser && onOpenChat) onOpenChat(otherUser)
                  onClose?.()
                }}
              >
                <div className="starred-thread-avatar">
                  {(otherUser?.avatar && <img src={otherUser.avatar} alt={title} />) || title[0]?.toUpperCase() || '?'}
                </div>
                <div className="starred-thread-meta">
                  <div className="starred-thread-row">
                    <strong>{title}</strong>
                    {dateLabel && <span className="starred-thread-date">{dateLabel}</span>}
                  </div>
                  <div className="starred-thread-subtitle">
                    {otherUser?.username || otherUser?.email || 'Conversation'}
                  </div>
                </div>
                <ChevronRight size={20} className="starred-thread-chevron" />
              </button>

              <div className="starred-thread-preview">
                {(latestMessage.messageType === 'photo' || latestMessage.messageType === 'camera') ? (
                  <div className="starred-thread-photo-wrap">
                    <img
                      src={latestMessage.content}
                      alt="Starred photo"
                      className="starred-thread-photo"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="starred-thread-bubble">
                    {previewText}
                  </div>
                )}
                <div className="starred-thread-footer">
                  <span className="starred-thread-star"><Star size={12} fill="currentColor" /></span>
                  <span>{formatMessageTime(latestMessage.sentAt || latestMessage.createdAt)}</span>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}