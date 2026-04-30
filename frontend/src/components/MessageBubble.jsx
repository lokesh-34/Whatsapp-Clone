import { motion } from 'framer-motion'
import { Play, Pause } from 'lucide-react'
import { useState, useRef } from 'react'

export default function MessageBubble({ message, isMine }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const audioRef = useRef(null)

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  })

  const isRead = Boolean(message.readAt || message.read)
  const isDelivered = Boolean(message.deliveredAt || isRead)

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setPlaybackTime(audioRef.current.currentTime)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setPlaybackTime(0)
  }

  // Determine message type and render accordingly
  const renderContent = () => {
    if (message.messageType === 'voice') {
      const duration = message.voiceDuration || 0
      return (
        <div className="voice-message-bubble">
          <button
            className="voice-play-btn"
            onClick={handlePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
          </button>
          <div className="voice-waveform">
            <div className="voice-progress-bar">
              <div
                className="voice-progress-fill"
                style={{
                  width: `${duration > 0 ? (playbackTime / duration) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="voice-duration">{formatDuration(duration)}</span>
          </div>
          <audio
            ref={audioRef}
            src={message.content}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            style={{ display: 'none' }}
          />
        </div>
      )
    }

    if (message.messageType === 'emoji') {
      return (
        <span className="emoji-message" style={{ fontSize: '48px' }}>
          {message.content}
        </span>
      )
    }

    // Default text message
    return <span className="bubble-text">{message.content}</span>
  }

  return (
    <motion.div
      className={`bubble-row ${isMine ? 'bubble-row--mine' : 'bubble-row--theirs'}`}
      initial={{ opacity: 0, x: isMine ? 24 : -24, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      layout
    >
      <div className={`bubble ${isMine ? 'bubble--sent' : 'bubble--received'}`}>
        {renderContent()}
        <span className="bubble-meta">
          <span className="bubble-time">{time}</span>
          {isMine && (
            <span className="bubble-tick" title={isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'}>
              {isRead ? (
                <svg width="16" height="11" viewBox="0 0 16 11" fill="#53bdeb">
                  <path d="M11.071.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.97-5.97z"/>
                  <path d="M14.571.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-.392.207l1.392-1.39 4.44-6.377z"/>
                </svg>
              ) : isDelivered ? (
                <svg width="16" height="11" viewBox="0 0 16 11" fill="#8696A0">
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
