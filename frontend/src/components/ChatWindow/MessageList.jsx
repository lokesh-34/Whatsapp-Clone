import { useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import MessageBubble from '../MessageBubble'

export default function MessageList({ messages, currentUser, loading }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div className="message-list message-list--loading">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="message-list" id="message-list">
      {messages.length === 0 ? (
        <div className="messages-empty">
          <span>No messages yet. Say hello! 👋</span>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble
              key={msg._id}
              message={msg}
              isMine={(msg.sender._id || msg.sender) === currentUser._id}
            />
          ))}
        </AnimatePresence>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
