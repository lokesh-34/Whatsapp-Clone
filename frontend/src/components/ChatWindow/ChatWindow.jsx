import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { motion } from 'framer-motion'
import { Avatar, AvatarFallback } from '../ui/avatar'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import TypingIndicator from './TypingIndicator'
import SpotlightCard from '../bits/SpotlightCard'
import GradientText from '../bits/GradientText'
import ShinyText from '../bits/ShinyText'

export default function ChatWindow({ currentUser, selectedUser, messages, loading, onSend, isOnline, isTyping }) {
  const emptyRef = useRef(null)

  useEffect(() => {
    if (!selectedUser && emptyRef.current) {
      const ctx = gsap.context(() => {
        gsap.fromTo('.empty-state-icon',
          { y: 0 },
          { y: -16, duration: 2.4, ease: 'sine.inOut', repeat: -1, yoyo: true }
        )
        gsap.fromTo(['.empty-state-title', '.empty-state-desc', '.empty-state-badge'],
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.15, delay: 0.2, ease: 'power2.out' }
        )
      }, emptyRef)
      return () => ctx.revert()
    }
  }, [selectedUser])

  if (!selectedUser) {
    return (
      <main className="chat-window chat-window--empty" ref={emptyRef}>
        <SpotlightCard spotlightColor="rgba(0,168,132,0.08)"
          style={{ padding: '40px', textAlign: 'center', background: 'transparent', maxWidth: 420 }}
        >
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <h2 className="empty-state-title" style={{ opacity: 0 }}>
              <GradientText colors={['#E9EDEF', '#8696A0', '#E9EDEF']} animationSpeed={10}>
                WhatsApp Web
              </GradientText>
            </h2>
            <p className="empty-state-desc" style={{ opacity: 0 }}>
              Send and receive messages without keeping your phone online.<br />
              Select a chat to start messaging.
            </p>
            <div className="empty-state-badge" style={{ opacity: 0 }}>
              <ShinyText text="🔒  End-to-end encrypted" color="#00A884" shineColor="#4ECDC4" speed={5} />
            </div>
          </div>
        </SpotlightCard>
      </main>
    )
  }

  return (
    <main className="chat-window">
      {/* Chat Header */}
      <motion.div
        className="chat-header"
        key={selectedUser._id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="chat-header-avatar-wrap">
          <Avatar style={{ background: selectedUser.avatarColor, width: 44, height: 44 }}>
            <AvatarFallback style={{ background: selectedUser.avatarColor, color: '#fff', fontSize: 18, fontWeight: 700 }}>
              {selectedUser.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className={`online-dot ${isOnline(selectedUser._id) ? 'online-dot--on' : ''}`} />
        </div>
        <div className="chat-header-info">
          <span className="chat-header-name">{selectedUser.username}</span>
          <motion.span
            className="chat-header-status"
            key={isTyping ? 'typing' : isOnline(selectedUser._id) ? 'online' : 'offline'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isTyping
              ? <span style={{ color: 'var(--wa-green)' }}>typing…</span>
              : isOnline(selectedUser._id) ? 'Online' : 'Last seen recently'
            }
          </motion.span>
        </div>
      </motion.div>

      <MessageList messages={messages} currentUser={currentUser} loading={loading} />
      {isTyping && <TypingIndicator />}
      <MessageInput onSend={onSend} selectedUser={selectedUser} />
    </main>
  )
}
