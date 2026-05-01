import { useState, useEffect, useCallback } from 'react'
import { useAuth }   from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import Sidebar       from '../components/Sidebar/Sidebar'
import ChatWindow    from '../components/ChatWindow/ChatWindow'
import ScheduledList from '../components/ChatWindow/ScheduledList'
import StarredMessages from '../components/ChatWindow/StarredMessages'
import { getMessages, sendMessage, searchUsers, getConversations, editMessage, getUsers, forwardMessage } from '../api'
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

  const getPreviewText = (messageType, content) => {
    if (messageType === 'voice') return '🎤 Voice message'
    if (messageType === 'photo' || messageType === 'camera') return '📷 Photo'
    if (messageType === 'video') return '🎬 Video'
    if (messageType === 'document') return '📄 Document'
    if (messageType === 'location') return '📍 Location'
    return content
  }

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
  const [forwardingMessage, setForwardingMessage] = useState(null)
  const [forwardUsers, setForwardUsers] = useState([])
  const [scheduledOpen, setScheduledOpen] = useState(false)
  const [starredOpen, setStarredOpen] = useState(false)

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
             
             // Determine preview text based on message type
             const previewContent = getPreviewText(lastMessage.messageType, content)
             
             return { ...conv, lastMessage: { ...lastMessage, content: previewContent } }
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
  const handleSend = useCallback(async (content, messageType = 'text', metadata = {}) => {
    if (!selectedUser || !content?.toString().trim()) return

    const updateRecent = (messageData, displayContent) => {
      setRecentChats(prev => {
        const entry   = prev.find(c => c.user._id === selectedUser._id)
        const newLast = {
          ...(messageData || {}),
          content: displayContent,
          createdAt: messageData?.createdAt || new Date().toISOString(),
          sender: user._id,
          messageType,
          attachmentMeta: messageData?.attachmentMeta || metadata.attachmentMeta || null,
          scheduledFor: messageData?.scheduledFor || metadata.scheduledFor || null,
          scheduledStatus: messageData?.scheduledStatus || (metadata.scheduledFor ? 'scheduled' : 'sent'),
          sentAt: messageData?.sentAt || null,
        }
        if (entry) {
          return [{ ...entry, lastMessage: newLast }, ...prev.filter(c => c.user._id !== selectedUser._id)]
        }
        return [{ user: selectedUser, lastMessage: newLast, unreadCount: 0 }, ...prev]
      })
    }

    try {
      const payload = await e2ee.encryptForChat(user._id, selectedUser._id, content)

      if (socket) {
        socket.emit('sendMessage', { 
          to: selectedUser._id, 
          ...payload,
          messageType,
          voiceDuration: metadata.duration || null,
          scheduledFor: metadata.scheduledFor || null,
          attachmentMeta: metadata.attachmentMeta || null,
        }, (res) => {
          if (res?.success) {
            const sentMessage = { ...res.message, content, messageType }
            setMessages(prev => [...prev, sentMessage])
            const sidebarPreview = getPreviewText(messageType, content)
            updateRecent(sentMessage, sidebarPreview)
          } else {
            console.error('Send failed:', res?.error || 'Unknown socket error')
          }
        })
      } else {
        const { data } = await sendMessage(selectedUser._id, {
          ...payload,
          scheduledFor: metadata.scheduledFor || null,
          messageType,
          voiceDuration: metadata.duration || null,
          attachmentMeta: metadata.attachmentMeta || null,
        })
        const sentMessage = { ...data.message, content, messageType }
        setMessages(prev => [...prev, sentMessage])
        const sidebarPreview = getPreviewText(messageType, content)
        updateRecent(sentMessage, sidebarPreview)
      }
    } catch (err) {
      console.error('Encrypted send failed:', err)
    }
  }, [socket, selectedUser, user])

  const handleEditMessage = useCallback(async (messageId, content) => {
    if (!selectedUser || !messageId || !content?.trim()) return

    const payload = await e2ee.encryptForChat(user._id, selectedUser._id, content)
    const { data } = await editMessage(messageId, payload)

    const editedAt = data?.message?.editedAt || new Date().toISOString()

    setMessages(prev => prev.map((msg) => {
      if (msg._id !== messageId) return msg
      return {
        ...msg,
        encryptedMessage: payload.encryptedMessage,
        iv: payload.iv,
        encryptedKey: payload.encryptedKey,
        content,
        editedAt,
      }
    }))

    setRecentChats(prev => prev.map((conv) => {
      if (conv.lastMessage?._id !== messageId) return conv
      return {
        ...conv,
        lastMessage: {
          ...conv.lastMessage,
          encryptedMessage: payload.encryptedMessage,
          iv: payload.iv,
          encryptedKey: payload.encryptedKey,
          content,
          editedAt,
        },
      }
    }))
  }, [selectedUser, user])

  const handleMessageUpdate = useCallback((messageId, updater) => {
    setMessages((prev) => prev.map((msg) => (msg._id === messageId ? updater(msg) : msg)))
    setRecentChats((prev) => prev.map((conv) => {
      if (conv.lastMessage?._id !== messageId) return conv
      return { ...conv, lastMessage: updater(conv.lastMessage) }
    }))
  }, [])

  const handleMessageRemove = useCallback((messageId) => {
    setMessages((prev) => prev.filter((msg) => msg._id !== messageId))
    setRecentChats((prev) => prev.map((conv) => {
      if (conv.lastMessage?._id !== messageId) return conv
      return { ...conv, lastMessage: null }
    }))
  }, [])

  const beginForward = useCallback(async (message) => {
    if (!message) return
    setForwardingMessage(message)
    try {
      const { data } = await getUsers()
      setForwardUsers(data.users || [])
    } catch (err) {
      console.error('Failed to load forward recipients:', err)
      setForwardUsers([])
    }
  }, [])

  const cancelForward = useCallback(() => {
    setForwardingMessage(null)
  }, [])

  const openScheduledMessages = useCallback(() => {
    if (!selectedUser) return
    setScheduledOpen(true)
  }, [selectedUser])

  const openStarredMessages = useCallback(() => {
    setStarredOpen(true)
  }, [])

  const handleForwardRecipientSelect = useCallback(async (recipient, message) => {
    if (!recipient || !message) return

    const payload = await e2ee.encryptForChat(user._id, recipient._id, message.content)
    await forwardMessage(message._id, { to: recipient._id, ...payload })

    const previewContent = getPreviewText(message.messageType, message.content)
    setRecentChats((prev) => {
      const entry = prev.find((conv) => conv.user._id === recipient._id)
      const newLast = {
        _id: message._id,
        content: previewContent,
        createdAt: new Date().toISOString(),
        sender: user._id,
        messageType: message.messageType,
        attachmentMeta: message.attachmentMeta || null,
        sentAt: new Date().toISOString(),
      }
      if (entry) {
        return [{ ...entry, lastMessage: newLast }, ...prev.filter((conv) => conv.user._id !== recipient._id)]
      }
      return [{ user: recipient, lastMessage: newLast, unreadCount: 0 }, ...prev]
    })

    setForwardingMessage(null)
  }, [user, getPreviewText])

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
        
        // Determine preview text based on message type
        const sidebarPreview = getPreviewText(msg.messageType, displayMsg.content)
        
        const newLast  = {
          content:   sidebarPreview,
          createdAt: msg.createdAt,
          sender:    msg.sender?._id || msg.sender,
          messageType: msg.messageType,
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

    const handleMessageStatusUpdated = ({ messageId, senderId, receiverId, deliveredAt, readAt, read, scheduledStatus, sentAt, scheduledFor }) => {
      if (!messageId) return

      setMessages(prev => prev.map((msg) => {
        if (msg._id !== messageId) return msg
        return {
          ...msg,
          deliveredAt: deliveredAt || msg.deliveredAt || null,
          readAt: readAt || msg.readAt || null,
          read: typeof read === 'boolean' ? read : (msg.read || !!readAt),
          scheduledStatus: scheduledStatus || msg.scheduledStatus || 'sent',
          sentAt: sentAt || msg.sentAt || null,
          scheduledFor: scheduledFor || msg.scheduledFor || null,
        }
      }))

      setRecentChats(prev => prev.map((conv) => {
        const convUserId = conv.user._id?.toString?.() || conv.user._id
        const statusUserId = (receiverId || senderId || '').toString()
        const lastMessageId = conv.lastMessage?._id?.toString?.() || conv.lastMessage?.id
        const statusMessageId = messageId.toString()

        if (convUserId !== statusUserId || (lastMessageId && lastMessageId !== statusMessageId)) return conv

        return {
          ...conv,
          lastMessage: {
            ...conv.lastMessage,
            deliveredAt: deliveredAt || conv.lastMessage?.deliveredAt || null,
            readAt: readAt || conv.lastMessage?.readAt || null,
            read: typeof read === 'boolean' ? read : (conv.lastMessage?.read || !!readAt),
            scheduledStatus: scheduledStatus || conv.lastMessage?.scheduledStatus || 'sent',
            sentAt: sentAt || conv.lastMessage?.sentAt || null,
            scheduledFor: scheduledFor || conv.lastMessage?.scheduledFor || null,
          },
        }
      }))
    }

    const handleTyping     = ({ from }) =>
      setTypingUsers(prev => new Set([...prev, from]))
    const handleStopTyping = ({ from }) =>
      setTypingUsers(prev => { const n = new Set(prev); n.delete(from); return n })

    const handleMessageEdited = async ({ messageId, encryptedMessage, iv, encryptedKey, editedAt }) => {
      if (!messageId) return

      // Decrypt the edited content
      let editedContent = '[edited message]'
      try {
        const decrypted = await e2ee.decryptMessageObject(user._id, { encryptedMessage, iv, encryptedKey }, selectedUser._id)
        editedContent = decrypted
      } catch (err) {
        console.warn('Failed to decrypt edited message:', err)
      }

      // Update messages list
      setMessages(prev => prev.map(msg => {
        if (msg._id !== messageId) return msg
        return {
          ...msg,
          encryptedMessage,
          iv,
          encryptedKey,
          content: editedContent,
          editedAt,
        }
      }))

      // Update recent chats if it's the last message
      setRecentChats(prev => prev.map(conv => {
        if (conv.lastMessage?._id !== messageId) return conv
        return {
          ...conv,
          lastMessage: {
            ...conv.lastMessage,
            encryptedMessage,
            iv,
            encryptedKey,
            content: editedContent,
            editedAt,
          },
        }
      }))
    }

    const handleMessagePinned = ({ messageId, pinned }) => {
      if (!messageId) return
      setMessages(prev => prev.map((msg) => (
        msg._id === messageId ? { ...msg, pinnedBy: pinned ? [user._id] : [] } : msg
      )))
    }

    const handleMessageStarred = ({ messageId, starred }) => {
      if (!messageId) return
      setMessages(prev => prev.map((msg) => (
        msg._id === messageId ? { ...msg, starredBy: starred ? [user._id] : [] } : msg
      )))
    }

    const handleMessageDeleted = ({ messageId, deletedForEveryone, actorId }) => {
      if (!messageId) return

      setMessages(prev => prev.filter((msg) => msg._id !== messageId))

      setRecentChats(prev => prev.map((conv) => {
        if (conv.lastMessage?._id !== messageId) return conv
        if (deletedForEveryone) {
          return { ...conv, lastMessage: null }
        }
        if (actorId && actorId.toString() === user._id.toString()) {
          return { ...conv, lastMessage: null }
        }
        return conv
      }))
    }

    socket.on('newMessage',        handleNewMessage)
    socket.on('userTyping',        handleTyping)
    socket.on('userStoppedTyping', handleStopTyping)
    socket.on('messageStatusUpdated', handleMessageStatusUpdated)
    socket.on('messageEdited', handleMessageEdited)
    socket.on('messagePinned', handleMessagePinned)
    socket.on('messageStarred', handleMessageStarred)
    socket.on('messageDeleted', handleMessageDeleted)

    return () => {
      socket.off('newMessage',        handleNewMessage)
      socket.off('userTyping',        handleTyping)
      socket.off('userStoppedTyping', handleStopTyping)
      socket.off('messageStatusUpdated', handleMessageStatusUpdated)
      socket.off('messageEdited', handleMessageEdited)
      socket.off('messagePinned', handleMessagePinned)
      socket.off('messageStarred', handleMessageStarred)
      socket.off('messageDeleted', handleMessageDeleted)
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
        onOpenStarred={openStarredMessages}
        onOpenScheduled={openScheduledMessages}
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
        onEditMessage={handleEditMessage}
        isOnline={isOnline}
        isTyping={selectedUser ? typingUsers.has(selectedUser._id) : false}
        onBack={() => setSelected(null)}
        forwardingMessage={forwardingMessage}
        forwardUsers={forwardUsers}
        onForwardRecipientSelect={handleForwardRecipientSelect}
        onCancelForward={cancelForward}
        onForwardRequest={beginForward}
        onMessageUpdate={handleMessageUpdate}
        onMessageRemove={handleMessageRemove}
        scheduledOpen={scheduledOpen}
        onOpenScheduled={openScheduledMessages}
        onCloseScheduled={() => setScheduledOpen(false)}
      />
      <StarredMessages
        open={starredOpen}
        onClose={() => setStarredOpen(false)}
        currentUser={user}
        onOpenChat={handleSelectUser}
      />
      <ScheduledList
        open={scheduledOpen && Boolean(selectedUser)}
        onClose={() => setScheduledOpen(false)}
        userId={selectedUser?._id}
        onCancelled={() => setScheduledOpen(false)}
      />
    </div>
  )
}
