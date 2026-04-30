import { useState, useEffect, useCallback } from 'react'
import { useAuth }   from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import Sidebar       from '../components/Sidebar/Sidebar'
import ChatWindow    from '../components/ChatWindow/ChatWindow'
import { getMessages, sendMessage, searchUsers, getConversations } from '../api'
import e2ee from '../lib/e2ee'

/* ── Debounce hook ─────────────────────────────────────────── */
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/* ── Chat Page ─────────────────────────────────────────────── */
export default function Chat() {
  const { user, logout }     = useAuth()
  const { socket, isOnline } = useSocket()

  // ── Search ────────────────────────────────────────────────
  const [searchQuery,   setSearch]    = useState('')
  const [searchResults, setResults]   = useState([])
  const [searchLoading, setSearching] = useState(false)
  const debouncedQuery                = useDebounce(searchQuery, 350)

  // ── Conversations (persisted via backend) ─────────────────
  const [recentChats, setRecentChats] = useState([])  // [{user, lastMessage, unreadCount}]

  // ── Active chat ───────────────────────────────────────────
  const [selectedUser,     setSelected]      = useState(null)
  const [messages,         setMessages]      = useState([])
  const [loadingMsgs,      setLoadingMsgs]   = useState(false)
  const [typingUsers,      setTypingUsers]   = useState(new Set())
  const [highlightedIndex, setHighlighted]   = useState(-1)

  /* ─────────────────────────────────────────────────────────
     Load conversations on mount → populates sidebar from DB
  ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!user) return
    getConversations()
       .then(async ({ data }) => {
         const conversations = data.conversations || []
         const hydrated = await Promise.all(conversations.map(async (conv) => {
           const lastMessage = conv.lastMessage
           if (!lastMessage?.encryptedMessage) return conv

           try {
             const content = await e2ee.decryptMessageObject(user._id, lastMessage, conv.user._id)
             return { ...conv, lastMessage: { ...lastMessage, content } }
           } catch (err) {
             console.warn('Conversation preview decrypt failed:', err)
             return { ...conv, lastMessage: { ...lastMessage, content: '[encrypted message]' } }
           }
         }))

         setRecentChats(hydrated)
      })
      .catch(err => console.error('Conversations error:', err))
  }, [user])

  /* ─────────────────────────────────────────────────────────
     Ensure my E2EE keypair exists and my public key is uploaded
  ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!user) return
    e2ee.ensureKeyPairAndUploadIfMissing()
      .catch(err => console.warn('E2EE key setup failed:', err))
  }, [user])

  /* ─────────────────────────────────────────────────────────
     Search users via debounced query
  ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q) { setResults([]); return }
    setSearching(true)
    setHighlighted(-1)
    searchUsers(q)
      .then(({ data }) => setResults(data.users || []))
      .catch(err => console.error('Search error:', err))
      .finally(() => setSearching(false))
  }, [debouncedQuery])

  /* ─────────────────────────────────────────────────────────
     Fetch messages when selected user changes
  ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!selectedUser) return
    setLoadingMsgs(true)
    setMessages([])

    getMessages(selectedUser._id)
      .then(async ({ data }) => {
        const incoming = data.messages || []
        const decrypted = await Promise.all(incoming.map(async (msg) => {
          if (!msg.encryptedMessage) return msg
          try {
            const content = await e2ee.decryptMessageObject(user._id, msg, selectedUser._id)
            return { ...msg, content }
          } catch (err) {
            console.warn('Decrypt failed:', err)
            return { ...msg, content: '[unable to decrypt]' }
          }
        }))

        setMessages(decrypted)
        // Clear unread badge
        setRecentChats(prev =>
          prev.map(c =>
            c.user._id === selectedUser._id ? { ...c, unreadCount: 0 } : c
          )
        )

        // Notify the sender that messages in this chat were read
        socket?.emit('messagesRead', { from: selectedUser._id })
      })
      .catch(err => console.error('Messages error:', err))
      .finally(() => setLoadingMsgs(false))
  }, [selectedUser, user])

  /* ─────────────────────────────────────────────────────────
     Select a user to open chat
  ───────────────────────────────────────────────────────── */
  const handleSelectUser = useCallback((u) => {
    setSelected(u)
    setMessages([])
    setSearch('')
    setResults([])
    setHighlighted(-1)

    // Ensure user appears in recentChats immediately
    setRecentChats(prev => {
      if (prev.find(c => c.user._id === u._id)) return prev
      return [{ user: u, lastMessage: null, unreadCount: 0 }, ...prev]
    })
  }, [])

    /* ─────────────────────────────────────────────────────────
      Send message as encrypted payload
    ───────────────────────────────────────────────────────── */
  const handleSend = useCallback(async (content) => {
    if (!selectedUser || !content.trim()) return

    const updateRecent = (content) => {
      setRecentChats(prev => {
        const entry   = prev.find(c => c.user._id === selectedUser._id)
        const newLast = { content, createdAt: new Date().toISOString(), sender: user._id }
        if (entry) {
          return [{ ...entry, lastMessage: newLast }, ...prev.filter(c => c.user._id !== selectedUser._id)]
        }
        return [{ user: selectedUser, lastMessage: newLast, unreadCount: 0 }, ...prev]
      })
    }

    try {
      const payload = await e2ee.encryptForChat(user._id, selectedUser._id, content)

      if (socket) {
        socket.emit('sendMessage', { to: selectedUser._id, ...payload }, (res) => {
          if (res?.success) {
            setMessages(prev => [...prev, { ...res.message, content }])
            updateRecent(content)
          } else {
            console.error('Send failed:', res?.error || 'Unknown socket error')
          }
        })
      } else {
        const { data } = await sendMessage(selectedUser._id, payload)
        setMessages(prev => [...prev, { ...data.message, content }])
        updateRecent(content)
      }
    } catch (err) {
      console.error('Encrypted send failed:', err)
    }
  }, [socket, selectedUser, user])

  /* ─────────────────────────────────────────────────────────
     Socket events — incoming messages, typing indicators
  ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = async (msg) => {
      const senderId   = (msg.sender?._id || msg.sender).toString()
      const isSelected = selectedUser && senderId === selectedUser._id.toString()

      let displayMsg = msg
      if (msg.encryptedMessage) {
        try {
          const content = await e2ee.decryptMessageObject(user._id, msg, senderId)
          displayMsg = { ...msg, content }
        } catch {
          displayMsg = { ...msg, content: '[unable to decrypt]' }
        }
      }

      if (isSelected) setMessages(prev => [...prev, displayMsg])

      // Update sidebar — bump unread count if chat not open
      setRecentChats(prev => {
        const exists   = prev.find(c => c.user._id.toString() === senderId)
        const newLast  = {
          content:   displayMsg.content,
          createdAt: msg.createdAt,
          sender:    msg.sender?._id || msg.sender,
        }
        if (exists) {
          return [
            {
              ...exists,
              lastMessage: newLast,
              unreadCount: isSelected ? 0 : (exists.unreadCount || 0) + 1,
            },
            ...prev.filter(c => c.user._id.toString() !== senderId),
          ]
        }
        return prev   // new sender — will appear after next conversations load
      })
    }

    const handleMessageStatusUpdated = ({ messageId, deliveredAt, readAt, read }) => {
      if (!messageId) return

      setMessages(prev => prev.map((msg) => {
        if (msg._id !== messageId) return msg
        return {
          ...msg,
          deliveredAt: deliveredAt || msg.deliveredAt || null,
          readAt: readAt || msg.readAt || null,
          read: typeof read === 'boolean' ? read : (msg.read || !!readAt),
        }
      }))
    }

    const handleTyping     = ({ from }) =>
      setTypingUsers(prev => new Set([...prev, from]))
    const handleStopTyping = ({ from }) =>
      setTypingUsers(prev => { const n = new Set(prev); n.delete(from); return n })

    socket.on('newMessage',        handleNewMessage)
    socket.on('userTyping',        handleTyping)
    socket.on('userStoppedTyping', handleStopTyping)
    socket.on('messageStatusUpdated', handleMessageStatusUpdated)

    return () => {
      socket.off('newMessage',        handleNewMessage)
      socket.off('userTyping',        handleTyping)
      socket.off('userStoppedTyping', handleStopTyping)
      socket.off('messageStatusUpdated', handleMessageStatusUpdated)
    }
  }, [socket, selectedUser, user])

  /* ─────────────────────────────────────────────────────────
     Keyboard navigation — ↑↓ list, Enter open, Esc close
  ───────────────────────────────────────────────────────── */
  const isSearchMode = debouncedQuery.trim().length > 0
  const displayList  = isSearchMode
    ? searchResults.map(u => ({ user: u, lastMessage: null, unreadCount: 0 }))
    : recentChats

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && selectedUser) {
        setSelected(null); return
      }
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const len = displayList.length
      if (!len) return

      if (e.key === 'ArrowDown')  { e.preventDefault(); setHighlighted(i => (i + 1) % len) }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setHighlighted(i => (i <= 0 ? len - 1 : i - 1)) }
      if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault()
        handleSelectUser(displayList[highlightedIndex].user)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        document.querySelector('.search-input')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedUser, highlightedIndex, displayList, handleSelectUser])

  /* ─────────────────────────────────────────────────────────
     Render
  ───────────────────────────────────────────────────────── */
  return (
    <div className={`chat-page ${selectedUser ? 'chat-open' : ''}`}>
      <Sidebar
        currentUser={user}
        conversations={displayList}
        selectedUser={selectedUser}
        onSelectUser={handleSelectUser}
        onLogout={logout}
        isOnline={isOnline}
        searchQuery={searchQuery}
        onSearch={setSearch}
        isSearchMode={isSearchMode}
        searchLoading={searchLoading}
        highlightedIndex={highlightedIndex}
      />
      <ChatWindow
        currentUser={user}
        selectedUser={selectedUser}
        messages={messages}
        loading={loadingMsgs}
        onSend={handleSend}
        isOnline={isOnline}
        isTyping={selectedUser ? typingUsers.has(selectedUser._id) : false}
        onBack={() => setSelected(null)}
      />
    </div>
  )
}
