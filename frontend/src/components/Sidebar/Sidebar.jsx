import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { Menu, Plus, Clock3, Star, LogOut, Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '../ui/avatar'
import ShinyText    from '../bits/ShinyText'
import GradientText from '../bits/GradientText'
import { togglePinConversation, toggleStarConversation, markConversationRead } from '../../api'

// ── Icons ────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const MiniSpinner = () => (
  <div style={{
    width: 15, height: 15, borderRadius: '50%',
    border: '2px solid rgba(0,168,132,.25)',
    borderTopColor: '#00A884',
    animation: 'spin .7s linear infinite',
    flexShrink: 0,
  }} />
)

// ── Context menu ──────────────────────────────────────────────
function ContextMenu({ position, conversation, onAddFavourite, onPin, onMarkAsRead, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose?.()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  if (!position) return null

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.12 }}
      style={{
        position: 'fixed',
        top: `${position.y}px`,
        left: `${position.x}px`,
        background: '#222B2F',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 1000,
        minWidth: '160px',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => { onAddFavourite?.(); onClose?.() }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '12px 16px',
          border: 'none',
          background: 'transparent',
          color: '#E9EDEF',
          fontSize: 13,
          cursor: 'pointer',
          transition: 'all 0.15s',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.08)'}
        onMouseLeave={(e) => e.target.style.background = 'transparent'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        Add to Favourites
      </button>
      <button
        type="button"
        onClick={() => { onPin?.(); onClose?.() }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '12px 16px',
          border: 'none',
          background: 'transparent',
          color: '#E9EDEF',
          fontSize: 13,
          cursor: 'pointer',
          transition: 'all 0.15s',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.08)'}
        onMouseLeave={(e) => e.target.style.background = 'transparent'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3 6h6l-5 4 2 6-6-5-6 5 2-6-5-4h6z"/>
        </svg>
        Pin Chat
      </button>
      <button
        type="button"
        onClick={() => { onMarkAsRead?.(); onClose?.() }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '12px 16px',
          border: 'none',
          background: 'transparent',
          color: '#E9EDEF',
          fontSize: 13,
          cursor: 'pointer',
          transition: 'all 0.15s',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.08)'}
        onMouseLeave={(e) => e.target.style.background = 'transparent'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Mark as Read
      </button>
    </motion.div>
  )
}

// ── Conversation item ────────────────────────────────────────
function ConversationItem({ conversation, isSelected, isHighlighted, isOnline, onClick, onContextMenu }) {
  const { user, lastMessage, unreadCount } = conversation

  const initial = user.username?.[0]?.toUpperCase() || '?'
  const online  = isOnline(user._id)
  const preview = lastMessage?.content || ''
  const myId = conversation.currentUserId
  const senderId = (lastMessage?.sender?._id || lastMessage?.sender)?.toString?.()
  const isMine = Boolean(myId && senderId && senderId === myId)
  const isRead = Boolean(lastMessage?.readAt || lastMessage?.read)
  const isDelivered = Boolean(lastMessage?.deliveredAt || isRead)
  const isScheduled = lastMessage?.scheduledStatus === 'scheduled'
  const time    = lastMessage?.createdAt
    ? new Date(lastMessage.sentAt || lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''
  const scheduledTime = lastMessage?.scheduledFor
    ? new Date(lastMessage.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <motion.div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(e, conversation)
      }}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={{ background: 'rgba(255,255,255,.04)' }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', cursor: 'pointer', borderRadius: 8,
        background: isSelected ? 'rgba(0,168,132,.12)' : isHighlighted ? 'rgba(0,168,132,.06)' : 'transparent',
        borderLeft: isSelected ? '3px solid #00A884' : isHighlighted ? '3px solid #00A884' : '3px solid transparent',
        boxShadow: isHighlighted && !isSelected ? 'inset 0 0 8px rgba(0,168,132,.1)' : 'none',
        transition: 'background .15s, border-color .15s, box-shadow .15s',
      }}
    >
      {/* Avatar with online dot */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar style={{ width: 42, height: 42, background: user.avatarColor }}>
          <AvatarFallback style={{ background: user.avatarColor, color: '#fff', fontWeight: 700, fontSize: 16 }}>
            {user.avatar
              ? <img src={user.avatar} alt={initial} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : initial
            }
          </AvatarFallback>
        </Avatar>
        {online && (
          <div style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 10, height: 10, borderRadius: '50%',
            background: '#00A884', border: '2px solid #111B21',
          }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#E9EDEF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.username}
          </span>
          {(time || scheduledTime) && (
            <span style={{ fontSize: 11, color: unreadCount > 0 ? '#00A884' : '#8696A0', flexShrink: 0, marginLeft: 6 }}>
              {isScheduled ? scheduledTime : time}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            {isMine && lastMessage && (
              <span title={isScheduled ? 'Scheduled' : isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {isScheduled ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8696A0" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                ) : isRead ? (
                  <svg width="14" height="10" viewBox="0 0 16 11" fill="#53bdeb">
                    <path d="M11.071.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.97-5.97z" />
                    <path d="M14.571.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-.392.207l1.392-1.39 4.44-6.377z" />
                  </svg>
                ) : isDelivered ? (
                  <svg width="14" height="10" viewBox="0 0 16 11" fill="#8696A0">
                    <path d="M11.071.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.97-5.97z" />
                    <path d="M14.571.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-.392.207l1.392-1.39 4.44-6.377z" />
                  </svg>
                ) : (
                  <svg width="12" height="10" viewBox="0 0 12 11" fill="#8696A0">
                    <path d="M10.071.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.97-5.97z" />
                  </svg>
                )}
              </span>
            )}
            <span style={{ fontSize: 12.5, color: '#8696A0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
              {preview || <em style={{ color: '#667781' }}>No messages yet</em>}
            </span>
          </div>
          {unreadCount > 0 && (
            <span style={{
              background: '#00A884', color: '#fff', borderRadius: '50%',
              minWidth: 18, height: 18, fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: 8, flexShrink: 0, padding: '0 4px',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Empty states ─────────────────────────────────────────────
function EmptyState({ isSearchMode, searchLoading, query, activeFilter }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35 })
  }, [isSearchMode, query, activeFilter])

  if (searchLoading) return (
    <div className="sidebar-empty" ref={ref}>
      <MiniSpinner />
      <p style={{ marginTop: 12, fontSize: 13 }}>Searching…</p>
    </div>
  )
  if (isSearchMode && query) return (
    <div className="sidebar-empty" ref={ref}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>🔍</div>
      <p style={{ fontWeight: 600, color: 'var(--wa-text-primary)', fontSize: 14, marginBottom: 4 }}>No users found</p>
      <p style={{ fontSize: 13 }}>Try a different username, email, or phone number</p>
    </div>
  )

  if (activeFilter === 'favourites') return (
    <div className="sidebar-empty" ref={ref} style={{ padding: '40px 20px' }}>
      <motion.div style={{ fontSize: 38, marginBottom: 14 }}
        animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>⭐</motion.div>
      <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--wa-text-primary)', marginBottom: 8 }}>No favourites found</p>
      <p style={{ fontSize: 13, color: 'var(--wa-text-muted)', lineHeight: 1.6 }}>
        Star a chat from the conversation menu to see it here.
      </p>
    </div>
  )

  if (activeFilter === 'groups') return (
    <div className="sidebar-empty" ref={ref} style={{ padding: '40px 20px' }}>
      <motion.div style={{ fontSize: 38, marginBottom: 14 }}
        animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>👥</motion.div>
      <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--wa-text-primary)', marginBottom: 8 }}>No groups found</p>
      <p style={{ fontSize: 13, color: 'var(--wa-text-muted)', lineHeight: 1.6 }}>
        Create a group to start chatting with multiple people.
      </p>
    </div>
  )

  return (
    <div className="sidebar-empty" ref={ref} style={{ padding: '40px 20px' }}>
      <motion.div style={{ fontSize: 38, marginBottom: 14 }}
        animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>🔍</motion.div>
      <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--wa-text-primary)', marginBottom: 8 }}>Find someone to chat with</p>
      <p style={{ fontSize: 13, color: 'var(--wa-text-muted)', lineHeight: 1.6 }}>
        Search by <strong style={{ color: 'var(--wa-text-secondary)' }}>username</strong>,{' '}
        <strong style={{ color: 'var(--wa-text-secondary)' }}>email</strong>, or{' '}
        <strong style={{ color: '#ff9800' }}>phone number</strong>
      </p>
    </div>
  )
}

// ── Main Sidebar ─────────────────────────────────────────────
export default function Sidebar({
  currentUser, conversations, selectedUser, onSelectUser,
  onLogout, onOpenStarred, onOpenScheduled, onOpenGroups, onConversationPreferenceChange, isOnline, searchQuery, onSearch, isSearchMode, searchLoading,  highlightedIndex = -1,}) {
  const showEmpty = conversations.length === 0
  const currentUserId = currentUser?._id?.toString?.() || currentUser?._id || currentUser?.id
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [contextMenu, setContextMenu] = useState(null)
  const [targetConversation, setTargetConversation] = useState(null)
  const menuRef = useRef(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const closeMenu = (event) => {
      if (menuRef.current?.contains(event.target)) return
      setMenuOpen(false)
    }

    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  const getFilteredConversations = () => {
    if (isSearchMode) return conversations
    
    switch (activeFilter) {
      case 'unread':
        return conversations.filter(conv => conv.unreadCount > 0)
      case 'groups':
        return conversations.filter(conv => conv.isGroup)
      case 'favourites':
        return conversations.filter(conv => conv.starred)
      case 'all':
      default:
        return conversations
    }
  }

  const displayConversations = getFilteredConversations()

  const handleContextMenu = (e, conversation) => {
    setTargetConversation(conversation)
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
    })
  }

  const handleAddFavourite = async () => {
    if (!targetConversation || saving) return
    setSaving(true)
    try {
      const userId = targetConversation.user._id
      if (onConversationPreferenceChange) {
        await onConversationPreferenceChange({ userId, type: 'star' })
      } else {
        const { data } = await toggleStarConversation(userId)
        console.log('Conversation starred/unstarred successfully', Boolean(data?.starred))
      }
    } catch (error) {
      console.error('Failed to toggle star:', error)
    } finally {
      setSaving(false)
    }
  }

  const handlePin = async () => {
    if (!targetConversation || saving) return
    setSaving(true)
    try {
      const userId = targetConversation.user._id
      if (onConversationPreferenceChange) {
        await onConversationPreferenceChange({ userId, type: 'pin' })
      } else {
        const { data } = await togglePinConversation(userId)
        console.log('Conversation pinned/unpinned successfully', Boolean(data?.pinned))
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleMarkAsRead = async () => {
    if (!targetConversation || saving) return
    setSaving(true)
    try {
      const userId = targetConversation.user._id
      if (onConversationPreferenceChange) {
        await onConversationPreferenceChange({ userId, type: 'read' })
      } else {
        await markConversationRead(userId)
        console.log('Conversation marked as read successfully')
      }
    } catch (error) {
      console.error('Failed to mark as read:', error)
    } finally {
      setSaving(false)
    }
  }

  const closeContextMenu = () => {
    setContextMenu(null)
    setTargetConversation(null)
  }

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            className="profile-icon-btn"
            title="Profile"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              color: '#8696A0',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,.08)'; e.target.style.color = '#E9EDEF' }}
            onMouseLeave={(e) => { e.target.style.background = 'none'; e.target.style.color = '#8696A0' }}
          >
            <Avatar style={{ background: currentUser?.avatarColor, width: 32, height: 32 }}>
              <AvatarFallback style={{ background: currentUser?.avatarColor, color: '#fff', fontSize: 12, fontWeight: 700 }}>
                {currentUser?.avatar
                  ? <img src={currentUser.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : currentUser?.username?.[0]?.toUpperCase()
                }
              </AvatarFallback>
            </Avatar>
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#E9EDEF', margin: 0 }}>Chats</h1>
        </div>
        <div className="sidebar-header-actions" ref={menuRef} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <motion.button
            type="button"
            className="icon-btn"
            title="New chat"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <Plus size={20} />
          </motion.button>
          <motion.button
            type="button"
            className="icon-btn"
            onClick={() => setMenuOpen((value) => !value)}
            title="Menu"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <Menu size={20} />
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="sidebar-menu-panel"
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
              >
                <button type="button" className="sidebar-menu-item" onClick={() => { setMenuOpen(false); onOpenStarred?.() }}>
                  <Star size={16} /> Starred messages
                </button>
                <button type="button" className="sidebar-menu-item" onClick={() => { setMenuOpen(false); onOpenGroups?.() }}>
                  <Users size={16} /> Groups
                </button>
                <button type="button" className="sidebar-menu-item" onClick={() => { setMenuOpen(false); onOpenScheduled?.() }} disabled={!selectedUser} title={!selectedUser ? 'Open a chat first' : 'Scheduled messages'}>
                  <Clock3 size={16} /> Scheduled messages
                </button>
                <button type="button" className="sidebar-menu-item sidebar-menu-item--danger" onClick={() => { setMenuOpen(false); onLogout?.() }}>
                  <LogOut size={16} /> Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Search bar */}
      <div className="sidebar-search">
        <motion.div
          className="search-wrap"
          animate={{ boxShadow: searchQuery ? '0 0 0 1.5px rgba(0,168,132,0.5)' : '0 0 0 0px transparent' }}
          transition={{ duration: 0.2 }}
        >
          <span className="search-icon">{searchLoading ? <MiniSpinner /> : <SearchIcon />}</span>
          <input
            id="user-search" type="text" className="search-input"
            placeholder="Search by username or email…"
            value={searchQuery} onChange={e => onSearch(e.target.value)}
            autoComplete="off" spellCheck={false}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button key="clear"
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                onClick={() => onSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696A0', padding: '0 2px', display: 'flex', alignItems: 'center' }}
                title="Clear"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '8px 12px',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
        WebkitScrollbar: 'none',
      }}>
        {[
          { label: 'All', key: 'all' },
          { label: 'Unread', key: 'unread' },
          { label: 'Favourites', key: 'favourites' },
          { label: 'Groups', key: 'groups' },
        ].map((filter) => (
          <motion.button
            key={filter.key}
            type="button"
            onClick={() => setActiveFilter(filter.key)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: 'none',
              background: activeFilter === filter.key ? 'rgba(0, 168, 132, 0.3)' : 'rgba(255, 255, 255, 0.08)',
              color: activeFilter === filter.key ? '#00A884' : '#8696A0',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            whileHover={{ background: activeFilter === filter.key ? 'rgba(0, 168, 132, 0.3)' : 'rgba(255, 255, 255, 0.12)', color: '#E9EDEF' }}
            whileTap={{ scale: 0.95 }}
          >
            {filter.label}
          </motion.button>
        ))}
        <motion.button
          type="button"
          style={{
            padding: '6px 12px',
            borderRadius: '20px',
            border: 'none',
            background: 'transparent',
            color: '#8696A0',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
          whileHover={{ color: '#E9EDEF' }}
          whileTap={{ scale: 0.95 }}
        >
          ▼
        </motion.button>
      </div>

      {/* Section label */}
      <AnimatePresence mode="wait">
        {!showEmpty && displayConversations.length > 0 && (
          <motion.div key={isSearchMode ? 'res' : 'rec'}
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ padding: '6px 16px 2px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' }}
          >
            <GradientText colors={['#8696A0', '#00A884', '#8696A0']} animationSpeed={14}>
              {isSearchMode ? `Results (${displayConversations.length})` : activeFilter === 'favourites' ? 'Favourites' : 'Recent Chats'}
            </GradientText>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="sidebar-list">
        <AnimatePresence mode="wait">
          {displayConversations.length === 0 && !isSearchMode
            ? <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmptyState isSearchMode={isSearchMode} searchLoading={searchLoading} query={searchQuery} activeFilter={activeFilter} />
              </motion.div>
            : <motion.div key="list">
                {displayConversations.map((conv, idx) => (
                  <ConversationItem
                    key={conv.user._id}
                    conversation={{ ...conv, currentUserId }}
                    isSelected={selectedUser?._id === conv.user._id}
                    isHighlighted={idx === highlightedIndex}
                    isOnline={isOnline}
                    onClick={() => onSelectUser(conv.user)}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </motion.div>
          }
        </AnimatePresence>
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            position={contextMenu}
            conversation={targetConversation}
            onAddFavourite={handleAddFavourite}
            onPin={handlePin}
            onMarkAsRead={handleMarkAsRead}
            onClose={closeContextMenu}
          />
        )}
      </AnimatePresence>
    </aside>
  )
}
