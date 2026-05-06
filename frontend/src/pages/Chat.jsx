import { useState, useEffect, useCallback } from 'react'
import { useAuth }   from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import Sidebar       from '../components/Sidebar/Sidebar'
import ChatWindow    from '../components/ChatWindow/ChatWindow'
import ScheduledList from '../components/ChatWindow/ScheduledList'
import StarredMessages from '../components/ChatWindow/StarredMessages'
import GroupManager from '../components/GroupManager/GroupManager'
import { getMessages, sendMessage, searchUsers, getConversations, editMessage, getUsers, forwardMessage, getGroups, getGroupMessages, sendGroupMessage, togglePinConversation, toggleStarConversation, markConversationRead } from '../api'
import e2ee from '../lib/e2ee'
import useChatStore from '../store/useChatStore'

/* ── Debounce hook ─────────────────────────────────────────── */
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function Chat() {
  const { user, logout }     = useAuth()
  const { socket, isOnline } = useSocket()
  
  // ── Zustand Store ─────────────────────────────────────────
  const { 
    selectedUser, setSelectedUser,
    messages, setMessages, addMessage,
    recentChats, setRecentChats,
    loadingMsgs, setLoadingMsgs,
    updateMessageStatus, updateMessage, removeMessage,
    updateConversation, bumpConversation
  } = useChatStore()

  const getPreviewText = (messageType, content) => {
    if (messageType === 'voice') return '🎤 Voice message'
    if (messageType === 'photo' || messageType === 'camera') return '📷 Photo'
    if (messageType === 'video') return '🎬 Video'
    if (messageType === 'document') return '📄 Document'
    if (messageType === 'location') return '📍 Location'
    return content
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  const [searchQuery,   setSearch]    = useState('')
  const [searchResults, setResults]   = useState([])
  const [searchLoading, setSearching] = useState(false)
  const debouncedQuery                = useDebounce(searchQuery, 350)

  const [highlightedIndex, setHighlighted]   = useState(-1)
  const [forwardingMessage, setForwardingMessage] = useState(null)
  const [forwardUsers, setForwardUsers] = useState([])
  const [scheduledOpen, setScheduledOpen] = useState(false)
  const [starredOpen, setStarredOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)

  // ── Load Conversations ────────────────────────────────────
  useEffect(() => {
    if (!user) return
    Promise.all([getConversations(), getGroups()])
      .then(async ([conversationsRes, groupsRes]) => {
        const conversations = conversationsRes?.data?.conversations || []
        const groups = groupsRes?.data?.groups || []

        const hydratedDirect = await Promise.all(conversations.map(async (conv) => {
          const lastMessage = conv.lastMessage
          if (!lastMessage?.encryptedMessage) return { ...conv, isGroup: false }
          try {
            const content = await e2ee.decryptMessageObject(user._id, lastMessage, conv.user._id)
            return { ...conv, isGroup: false, lastMessage: { ...lastMessage, content: getPreviewText(lastMessage.messageType, content) } }
          } catch {
            return { ...conv, isGroup: false, lastMessage: { ...lastMessage, content: '[encrypted]' } }
          }
        }))

        const hydratedGroups = groups.map((group) => ({
          user: { _id: group._id, username: group.name, avatarColor: '#22313a', avatar: group.avatar || null, isGroup: true, description: group.description || '', members: group.members || [] },
          lastMessage: group.lastMessage ? { ...group.lastMessage, content: getPreviewText(group.lastMessage.messageType, group.lastMessage.encryptedMessage || '') } : null,
          unreadCount: group.unreadCount || 0,
          isGroup: true,
        }))

        const merged = [...hydratedDirect, ...hydratedGroups].sort((a, b) => {
          const aTime = new Date(a.lastMessage?.sentAt || a.lastMessage?.createdAt || 0).getTime()
          const bTime = new Date(b.lastMessage?.sentAt || b.lastMessage?.createdAt || 0).getTime()
          return bTime - aTime
        })
        setRecentChats(merged)
      })
      .catch(err => console.error('Conversations error:', err))
  }, [user, setRecentChats])

  useEffect(() => {
    if (!user) return
    e2ee.ensureKeyPairAndUploadIfMissing().catch(console.warn)
  }, [user])

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q) { setResults([]); return }
    setSearching(true)
    searchUsers(q)
      .then(({ data }) => setResults(data.users || []))
      .catch(console.error)
      .finally(() => setSearching(false))
  }, [debouncedQuery])

  // ── Fetch Messages ───────────────────────────────────────
  useEffect(() => {
    if (!selectedUser) return
    setLoadingMsgs(true)
    const fetcher = selectedUser.isGroup ? getGroupMessages(selectedUser._id) : getMessages(selectedUser._id)
    fetcher
      .then(async ({ data }) => {
        const incoming = data.messages || []
        const decrypted = selectedUser.isGroup
          ? incoming.map((msg) => ({ ...msg, content: msg.encryptedMessage }))
          : await Promise.all(incoming.map(async (msg) => {
              if (!msg.encryptedMessage) return msg
              try {
                const content = await e2ee.decryptMessageObject(user._id, msg, selectedUser._id)
                return { ...msg, content }
              } catch { return { ...msg, content: '[encrypted]' } }
            }))
        setMessages(decrypted)
        updateConversation(selectedUser._id, { unreadCount: 0 })
        if (!selectedUser.isGroup) socket?.emit('messagesRead', { from: selectedUser._id })
        else socket?.emit('groupMessagesRead', { groupId: selectedUser._id })
      })
      .catch(console.error)
      .finally(() => setLoadingMsgs(false))
  }, [selectedUser, user, socket, setMessages, setLoadingMsgs, updateConversation])

  const handleSelectUser = useCallback((u) => {
    setSelectedUser(u)
    setSearch(''); setResults([]); setHighlighted(-1)
    setRecentChats(prev => {
      if (prev.find(c => c.user._id === u._id)) return prev
      return [{ user: u, lastMessage: null, unreadCount: 0 }, ...prev]
    })
  }, [setSelectedUser, setRecentChats])

  const showIncomingNotification = useCallback((message, { isGroup, isSelected }) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (!document.hidden && isSelected) return

    const senderName = message.sender?.username || 'New message'
    const groupName = message.group?.name || 'Group chat'
    const title = isGroup ? `${senderName} in ${groupName}` : senderName
    const body = (message.content || '').toString().trim() || 'New message received'
    const notification = new Notification(title, {
      body,
      icon: '/vite.svg',
      tag: isGroup ? `group-${message.group?._id || message.group || 'chat'}` : `chat-${message.sender?._id || message.sender || 'chat'}`,
    })

    notification.onclick = () => {
      window.focus()
      if (isSelected) return
      if (isGroup && message.group) {
        handleSelectUser({
          _id: message.group._id || message.group,
          username: message.group.name || 'Group chat',
          avatar: message.group.avatar || null,
          avatarColor: '#22313a',
          isGroup: true,
        })
      } else if (!isGroup && message.sender) {
        handleSelectUser(message.sender)
      }
      notification.close()
    }
  }, [handleSelectUser])

  const handleSend = useCallback(async (content, messageType = 'text', metadata = {}) => {
    if (!selectedUser || !content?.toString().trim()) return
    const updateSide = (msg, text) => bumpConversation(selectedUser._id, { ...msg, content: text }, true)

    try {
      if (selectedUser.isGroup) {
        socket?.emit('sendGroupMessage', { groupId: selectedUser._id, content, messageType, voiceDuration: metadata.duration || null, attachmentMeta: metadata.attachmentMeta || null }, (res) => {
          if (res?.success) {
            const msg = { ...res.message, content, messageType }
            addMessage(msg); updateSide(msg, getPreviewText(messageType, content))
          }
        })
      } else {
        const payload = await e2ee.encryptForChat(user._id, selectedUser._id, content)
        socket?.emit('sendMessage', { to: selectedUser._id, ...payload, messageType, voiceDuration: metadata.duration || null, scheduledFor: metadata.scheduledFor || null, attachmentMeta: metadata.attachmentMeta || null }, (res) => {
          if (res?.success) {
            const msg = { ...res.message, content, messageType }
            addMessage(msg); updateSide(msg, getPreviewText(messageType, content))
          }
        })
      }
    } catch (err) { console.error('Send failed:', err) }
  }, [socket, selectedUser, user, addMessage, bumpConversation])

  const handleEditMessage = useCallback(async (messageId, content) => {
    if (!selectedUser || !messageId || !content?.trim()) return
    const payload = await e2ee.encryptForChat(user._id, selectedUser._id, content)
    const { data } = await editMessage(messageId, payload)
    updateMessage(messageId, (msg) => ({ ...msg, ...payload, content, editedAt: data?.message?.editedAt }))
  }, [selectedUser, user, updateMessage])

  const handleConversationPreferenceChange = useCallback(async ({ userId, type }) => {
    if (!userId || !type) return
    if (type === 'star') {
      const { data } = await toggleStarConversation(userId)
      updateConversation(userId, { starred: Boolean(data?.starred) })
    } else if (type === 'pin') {
      const { data } = await togglePinConversation(userId)
      updateConversation(userId, { pinned: Boolean(data?.pinned) })
    } else if (type === 'read') {
      await markConversationRead(userId)
      updateConversation(userId, { unreadCount: 0 })
    }
  }, [updateConversation])

  // ── Socket Events ────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = async (msg) => {
      const senderId = (msg.sender?._id || msg.sender)?.toString?.()
      const isGroup = Boolean(msg.group)
      const targetId = isGroup ? msg.group.toString() : senderId
      if (isGroup && senderId === user?._id?.toString?.()) return
      const isSelected = isGroup ? selectedUser?._id === targetId : selectedUser?._id === senderId

      let displayMsg = msg
      if (isGroup) displayMsg = { ...msg, content: msg.encryptedMessage }
      else if (msg.encryptedMessage) {
        try { displayMsg = { ...msg, content: await e2ee.decryptMessageObject(user._id, msg, senderId) } }
        catch { displayMsg = { ...msg, content: '[encrypted]' } }
      }

      if (isSelected) addMessage(displayMsg)
      bumpConversation(targetId, { ...displayMsg, content: getPreviewText(msg.messageType, displayMsg.content) }, isSelected)

      // If the chat is currently open, mark as read immediately so sender gets blue ticks.
      if (isSelected) {
        if (isGroup) {
          const groupId = (msg.group?._id || msg.group)?.toString?.()
          if (groupId) socket?.emit('groupMessagesRead', { groupId })
        } else {
          if (senderId) socket?.emit('messagesRead', { from: senderId })
        }
      }

      showIncomingNotification(
        { ...displayMsg, content: getPreviewText(msg.messageType, displayMsg.content) },
        { isGroup, isSelected }
      )
    }

    socket.on('newMessage', handleNewMessage)
    socket.on('messageStatusUpdated', updateMessageStatus)
    socket.on('messageEdited', async (data) => {
      try {
        const content = await e2ee.decryptMessageObject(user._id, data, selectedUser?._id)
        updateMessage(data.messageId, m => ({ ...m, ...data, content }))
      } catch { updateMessage(data.messageId, m => ({ ...m, ...data, content: '[edited]' })) }
    })
    socket.on('messagePinned', ({ messageId, pinned }) => updateMessage(messageId, m => ({ ...m, pinnedBy: pinned ? [user._id] : [] })))
    socket.on('messageStarred', ({ messageId, starred }) => updateMessage(messageId, m => ({ ...m, starredBy: starred ? [user._id] : [] })))
    socket.on('messageDeleted', ({ messageId }) => removeMessage(messageId))

    return () => {
      socket.off('newMessage')
      socket.off('messageStatusUpdated')
      socket.off('messageEdited')
      socket.off('messagePinned')
      socket.off('messageStarred')
      socket.off('messageDeleted')
    }
  }, [socket, selectedUser, user, addMessage, bumpConversation, updateMessageStatus, updateMessage, removeMessage, showIncomingNotification])

  const isSearchMode = debouncedQuery.trim().length > 0
  const displayList  = isSearchMode ? searchResults.map(u => ({ user: u, lastMessage: null, unreadCount: 0 })) : recentChats

  return (
    <div className={`chat-page ${selectedUser ? 'chat-open' : ''}`}>
      <Sidebar
        currentUser={user}
        conversations={displayList}
        selectedUser={selectedUser}
        onSelectUser={handleSelectUser}
        onConversationPreferenceChange={handleConversationPreferenceChange}
        onLogout={logout}
        onOpenStarred={() => setStarredOpen(true)}
        onOpenScheduled={() => setScheduledOpen(true)}
        onOpenGroups={() => setGroupsOpen(true)}
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
        onBack={() => setSelectedUser(null)}
        forwardingMessage={forwardingMessage}
        forwardUsers={forwardUsers}
        onForwardRecipientSelect={async (recipient, message) => {
          const payload = await e2ee.encryptForChat(user._id, recipient._id, message.content)
          await forwardMessage(message._id, { to: recipient._id, ...payload })
          bumpConversation(recipient._id, { ...message, content: getPreviewText(message.messageType, message.content) })
          setForwardingMessage(null)
        }}
        onCancelForward={() => setForwardingMessage(null)}
        onForwardRequest={async (msg) => {
          setForwardingMessage(msg)
          getUsers().then(res => setForwardUsers(res.data.users || []))
        }}
        onMessageUpdate={updateMessage}
        onMessageRemove={removeMessage}
        onCreateGroup={() => setGroupsOpen(true)}
        scheduledOpen={scheduledOpen}
        onOpenScheduled={() => setScheduledOpen(true)}
        onCloseScheduled={() => setScheduledOpen(false)}
      />
      <StarredMessages open={starredOpen} onClose={() => setStarredOpen(false)} currentUser={user} onOpenChat={handleSelectUser} />
      <GroupManager open={groupsOpen} onClose={() => setGroupsOpen(false)} currentUser={user} />
      <ScheduledList open={scheduledOpen && !!selectedUser} onClose={() => setScheduledOpen(false)} userId={selectedUser?._id} onCancelled={() => setScheduledOpen(false)} />
    </div>
  )
}
