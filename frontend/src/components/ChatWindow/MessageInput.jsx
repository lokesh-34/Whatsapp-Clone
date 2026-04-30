import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocket } from '../../context/SocketContext'
import { Send } from 'lucide-react'

export default function MessageInput({ onSend, selectedUser }) {
  const [text, setText]     = useState('')
  const [typing, setTyping] = useState(false)
  const { socket }          = useSocket()
  const typingTimer         = useRef(null)
  const inputRef            = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [selectedUser])

  const handleChange = (e) => {
    setText(e.target.value)
    if (socket && selectedUser) {
      if (!typing) { setTyping(true); socket.emit('typing', { to: selectedUser._id }) }
      clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => {
        setTyping(false)
        socket.emit('stopTyping', { to: selectedUser._id })
      }, 1500)
    }
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
    clearTimeout(typingTimer.current)
    if (typing && socket && selectedUser) {
      setTyping(false)
      socket.emit('stopTyping', { to: selectedUser._id })
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const hasText = text.trim().length > 0

  return (
    <div className="message-input-bar">
      <textarea
        ref={inputRef} id="message-input" className="message-textarea"
        placeholder="Type a message" value={text}
        onChange={handleChange} onKeyDown={handleKeyDown} rows={1}
      />
      <motion.button
        id="send-btn"
        className={`send-btn ${hasText ? 'send-btn--active' : ''}`}
        onClick={handleSend}
        disabled={!hasText}
        whileHover={hasText ? { scale: 1.12 } : {}}
        whileTap={hasText ? { scale: 0.88, rotate: 15 } : {}}
        animate={hasText
          ? { backgroundColor: '#00A884', rotate: 0 }
          : { backgroundColor: '#667781', rotate: 0 }
        }
        transition={{ duration: 0.2 }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={hasText ? 'send' : 'idle'}
            initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 20 }}
            transition={{ duration: 0.15 }}
          >
            <Send size={18} />
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
