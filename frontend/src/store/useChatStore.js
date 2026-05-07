import { create } from 'zustand'

const useChatStore = create((set, get) => ({
  selectedUser: null,
  messages: [],
  recentChats: [],
  loadingMsgs: false,

  // ── Actions ────────────────────────────────────────────────
  setSelectedUser: (user) => set({ 
    selectedUser: user, 
    messages: [], 
    loadingMsgs: false 
  }),

  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),

  setLoadingMsgs: (loading) => set({ loadingMsgs: loading }),

  setRecentChats: (chats) => set((state) => {
    const nextChats = typeof chats === 'function' ? chats(state.recentChats) : chats;
    return { recentChats: Array.isArray(nextChats) ? nextChats : [] };
  }),

  // ── Real-time Status Updates ───────────────────────────────
  updateMessageStatus: ({ messageIds, messageId, deliveredAt, readAt, read, scheduledStatus, sentAt, scheduledFor }) => {
    const normalizedIds = Array.isArray(messageIds) && messageIds.length
      ? messageIds
      : (messageId ? [messageId] : [])

    const idStrings = normalizedIds.map((id) => id.toString())
    
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (!idStrings.includes(msg._id.toString())) return msg
        return {
          ...msg,
          deliveredAt: deliveredAt || msg.deliveredAt || null,
          readAt: readAt || msg.readAt || null,
          read: typeof read === 'boolean' ? read : (msg.read || !!readAt),
          scheduledStatus: scheduledStatus || msg.scheduledStatus || 'sent',
          sentAt: sentAt || msg.sentAt || null,
          scheduledFor: scheduledFor || msg.scheduledFor || null,
        }
      }),
      recentChats: state.recentChats.map((conv) => {
        const lastMsgId = conv.lastMessage?._id?.toString()
        if (lastMsgId && idStrings.includes(lastMsgId)) {
          return {
            ...conv,
            lastMessage: {
              ...conv.lastMessage,
              deliveredAt: deliveredAt || conv.lastMessage.deliveredAt || null,
              readAt: readAt || conv.lastMessage.readAt || null,
              read: typeof read === 'boolean' ? read : (conv.lastMessage.read || !!readAt),
              scheduledStatus: scheduledStatus || conv.lastMessage.scheduledStatus || 'sent',
              sentAt: sentAt || conv.lastMessage.sentAt || null,
              scheduledFor: scheduledFor || conv.lastMessage.scheduledFor || null,
            }
          }
        }
        return conv
      })
    }))
  },

  updateMessage: (messageId, updater) => set((state) => ({
    messages: state.messages.map(msg => msg._id === messageId ? updater(msg) : msg),
    recentChats: state.recentChats.map(conv => {
      if (conv.lastMessage?._id === messageId) {
        return { ...conv, lastMessage: updater(conv.lastMessage) }
      }
      return conv
    })
  })),

  removeMessage: (messageId) => set((state) => ({
    messages: state.messages.filter(msg => msg._id !== messageId),
    recentChats: state.recentChats.map(conv => {
      if (conv.lastMessage?._id === messageId) {
        return { ...conv, lastMessage: null }
      }
      return conv
    })
  })),

  updateConversation: (userId, patch) => set((state) => ({
    recentChats: Array.isArray(state.recentChats) 
      ? state.recentChats.map((conv) => {
          const convId = conv.user?._id?.toString() || conv.user?._id
          if (convId !== userId.toString()) return conv
          return { ...conv, ...patch }
        })
      : []
  })),

  // Bump a conversation to the top with a new message
  bumpConversation: (userId, lastMessage, isSelected = false) => set((state) => {
    const targetId = userId.toString()
    const chats = Array.isArray(state.recentChats) ? state.recentChats : []
    const entry = chats.find(c => (c.user?._id || c.user)?.toString() === targetId)

    const inferredIsGroup = Boolean(lastMessage?.group)
    const lastSenderId = (lastMessage?.sender?._id || lastMessage?.sender)?.toString?.()
    const shouldIncrementUnread = !isSelected && (
      inferredIsGroup ? true : (lastSenderId && lastSenderId === targetId)
    )

    let inferredUser = entry?.user || { _id: userId }
    if (inferredIsGroup && lastMessage?.group) {
      const group = lastMessage.group
      inferredUser = {
        _id: group._id || group,
        username: group.name || 'Group chat',
        avatar: group.avatar || null,
        avatarColor: '#22313a',
        description: group.description || '',
        members: group.members || [],
        isGroup: true,
      }
    } else if (!inferredIsGroup && lastMessage?.sender && lastSenderId === targetId) {
      const sender = lastMessage.sender
      inferredUser = {
        ...(typeof sender === 'object' ? sender : { _id: sender }),
        username: (typeof sender === 'object' ? sender.username : undefined) || 'Unknown',
        avatarColor: (typeof sender === 'object' ? sender.avatarColor : undefined) || '#22313a',
        isGroup: false,
      }
    } else {
      inferredUser = {
        ...inferredUser,
        username: inferredUser?.username || 'Unknown',
        avatarColor: inferredUser?.avatarColor || '#22313a',
        isGroup: Boolean(inferredUser?.isGroup) || inferredIsGroup,
      }
    }
    
    const updatedEntry = entry 
      ? { 
          ...entry, 
          lastMessage, 
          isGroup: typeof entry.isGroup === 'boolean' ? entry.isGroup : inferredIsGroup,
          user: { ...inferredUser, isGroup: inferredUser?.isGroup ?? inferredIsGroup },
          unreadCount: isSelected ? 0 : (entry.unreadCount || 0) + (shouldIncrementUnread ? 1 : 0),
        }
      : {
          user: { ...inferredUser, isGroup: inferredUser?.isGroup ?? inferredIsGroup },
          isGroup: inferredIsGroup,
          lastMessage,
          unreadCount: shouldIncrementUnread ? 1 : 0,
        }

    const filtered = chats.filter(c => (c.user?._id || c.user)?.toString() !== targetId)
    return { recentChats: [updatedEntry, ...filtered] }
  })
}))

export default useChatStore
