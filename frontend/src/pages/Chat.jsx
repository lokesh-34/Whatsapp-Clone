import { useState, useEffect, useCallback } from 'react'
import { useAuth }   from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import Sidebar       from '../components/Sidebar/Sidebar'
import ChatWindow    from '../components/ChatWindow/ChatWindow'
import { getMessages, sendMessage, getUsers } from '../api'

export default function Chat() {
  const { user, logout }     = useAuth()
  const { socket, isOnline } = useSocket()

  const [users, setUsers]             = useState([])
  const [selectedUser, setSelected]   = useState(null)
  const [messages, setMessages]       = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [unreadMap, setUnreadMap]     = useState({})
  const [searchQuery, setSearch]      = useState('')
  const [typingUsers, setTypingUsers] = useState(new Set())

  useEffect(() => {
    getUsers().then(({ data }) => setUsers(data.users)).catch(console.error)
  }, [])

  useEffect(() => {
    if (!selectedUser) return
    setLoadingMsgs(true)
    getMessages(selectedUser._id)
      .then(({ data }) => {
        setMessages(data.messages)
        setUnreadMap(prev => ({ ...prev, [selectedUser._id]: 0 }))
      })
      .catch(console.error)
      .finally(() => setLoadingMsgs(false))
  }, [selectedUser])

  useEffect(() => {
    if (!socket) return
    const handleNewMessage = (msg) => {
      const senderId = msg.sender._id || msg.sender
      if (selectedUser && senderId === selectedUser._id) {
        setMessages(prev => [...prev, msg])
      } else {
        setUnreadMap(prev => ({ ...prev, [senderId]: (prev[senderId] || 0) + 1 }))
      }
    }
    const handleTyping     = ({ from }) => setTypingUsers(prev => new Set([...prev, from]))
    const handleStopTyping = ({ from }) => setTypingUsers(prev => {
      const next = new Set(prev); next.delete(from); return next
    })
    socket.on('newMessage', handleNewMessage)
    socket.on('userTyping', handleTyping)
    socket.on('userStoppedTyping', handleStopTyping)
    return () => {
      socket.off('newMessage', handleNewMessage)
      socket.off('userTyping', handleTyping)
      socket.off('userStoppedTyping', handleStopTyping)
    }
  }, [socket, selectedUser])

  const handleSend = useCallback(async (content) => {
    if (!selectedUser || !content.trim()) return
    if (socket) {
      socket.emit('sendMessage', { to: selectedUser._id, content }, (res) => {
        if (res.success) setMessages(prev => [...prev, res.message])
      })
    } else {
      try {
        const { data } = await sendMessage(selectedUser._id, content)
        setMessages(prev => [...prev, data.message])
      } catch (err) { console.error('Send failed:', err) }
    }
  }, [socket, selectedUser])

  const handleSelectUser = (u) => { setSelected(u); setMessages([]) }
  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const isTyping = selectedUser ? typingUsers.has(selectedUser._id) : false

  return (
    <div className="chat-page">
      <Sidebar
        currentUser={user} users={filteredUsers} selectedUser={selectedUser}
        onSelectUser={handleSelectUser} onLogout={logout} isOnline={isOnline}
        unreadMap={unreadMap} searchQuery={searchQuery} onSearch={setSearch}
      />
      <ChatWindow
        currentUser={user} selectedUser={selectedUser} messages={messages}
        loading={loadingMsgs} onSend={handleSend} isOnline={isOnline}
        isTyping={isTyping}
      />
    </div>
  )
}
