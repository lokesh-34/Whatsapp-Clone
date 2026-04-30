import { motion } from 'framer-motion'

export default function MessageBubble({ message, isMine }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <motion.div
      className={`bubble-row ${isMine ? 'bubble-row--mine' : 'bubble-row--theirs'}`}
      initial={{ opacity: 0, x: isMine ? 24 : -24, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      layout
    >
      <div className={`bubble ${isMine ? 'bubble--sent' : 'bubble--received'}`}>
        <span className="bubble-text">{message.content}</span>
        <span className="bubble-meta">
          <span className="bubble-time">{time}</span>
          {isMine && (
            <span className="bubble-tick" title={message.read ? 'Read' : 'Delivered'}>
              {message.read ? (
                <svg width="16" height="11" viewBox="0 0 16 11" fill="#53bdeb">
                  <path d="M11.071.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.97-5.97z"/>
                  <path d="M14.571.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-.392.207l1.392-1.39 4.44-6.377z"/>
                </svg>
              ) : (
                <svg width="12" height="11" viewBox="0 0 12 11" fill="#8696A0">
                  <path d="M10.071.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.97-5.97z"/>
                </svg>
              )}
            </span>
          )}
        </span>
      </div>
    </motion.div>
  )
}
