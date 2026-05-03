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

  setRecentChats: (chats) => set({ recentChats: chats }),

  // ── Real-time Status Updates ───────────────────────────────
  updateMessageStatus: ({ messageIds, deliveredAt, readAt, read, scheduledStatus, sentAt, scheduledFor }) => {
    const idStrings = (messageIds || []).map(id => id.toString())
    
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
    recentChats: state.recentChats.map((conv) => {
      const convId = conv.user._id?.toString() || conv.user._id
      if (convId !== userId.toString()) return conv
      return { ...conv, ...patch }
    })
  })),

  // Bump a conversation to the top with a new message
  bumpConversation: (userId, lastMessage, isSelected = false) => set((state) => {
    const targetId = userId.toString()
    const entry = state.recentChats.find(c => c.user._id.toString() === targetId)
    
    const updatedEntry = entry 
      ? { 
          ...entry, 
          lastMessage, 
          unreadCount: isSelected ? 0 : (entry.unreadCount || 0) + (lastMessage.sender === userId ? 1 : 0) 
        }
      : { user: { _id: userId }, lastMessage, unreadCount: 1 } // Fallback for new chats

    const filtered = state.recentChats.filter(c => c.user._id.toString() !== targetId)
    return { recentChats: [updatedEntry, ...filtered] }
  })
}))

export default useChatStore
