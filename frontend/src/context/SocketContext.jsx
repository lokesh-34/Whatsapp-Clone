/**
 * ─── SOCKET CONTEXT ──────────────────────────────────────────────────────────
 * Manages the global WebSocket lifecycle and presence state.
 * 
 * Key Responsibilities:
 * 1. Connection Management: Establishes and tears down the socket connection 
 *    based on the user's authentication state.
 * 2. Presence Tracking: Maintains a real-time list of online users.
 * 3. Security: Injects the JWT token into the socket handshake for server-side auth.
 * ──────────────────────────────────────────────────────────────────────────────
 */
import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export const SocketProvider = ({ children }) => {
  const { token, user }           = useAuth()
  const [socket, setSocket]       = useState(null)
  const [onlineUsers, setOnline]  = useState([])
  const socketRef                 = useRef(null)

  useEffect(() => {
    if (!token || !user) {
      // Disconnect if no user
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocket(null)
      }
      return
    }

    // Connect socket with JWT auth
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      console.log('🔌 Socket connected:', newSocket.id)
    })

    newSocket.on('onlineUsers', (userIds) => {
      setOnline(userIds)
    })

    newSocket.on('connect_error', (err) => {
      console.error('Socket error:', err.message)
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [token, user])

  const isOnline = (userId) => onlineUsers.includes(userId)

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, isOnline }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}
