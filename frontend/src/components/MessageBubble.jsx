import { motion } from 'framer-motion'
import { Play, Pause, Clock, Edit, Maximize2, Download, Save, Share2, Pin, Star, ChevronDown } from 'lucide-react'
import { useState, useRef } from 'react'

export default function MessageBubble({ message, isMine, onEditRequest, onOpenMedia, onForwardRequest, onContextMenu, onMenuClick, isPinned = false, isStarred = false, menuActive = false }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const audioRef = useRef(null)
  const arrowRef = useRef(null)

  const timeSource = message.sentAt || message.createdAt
  const time = new Date(timeSource).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  })

  const isRead = Boolean(message.readAt || message.read)
  const isDelivered = Boolean(message.deliveredAt || isRead)
  const isScheduled = message.scheduledStatus === 'scheduled'
  const seenByMembers = Array.isArray(message.seenBy)
    ? message.seenBy
        .map((entry) => entry?.user)
        .filter(Boolean)
        .reduce((unique, member) => {
          const memberId = member?._id?.toString?.() || member?.toString?.() || member?.id
          if (!memberId || unique.some((item) => (item._id?.toString?.() || item?.toString?.() || item?.id) === memberId)) return unique
          unique.push(member)
          return unique
        }, [])
    : []
  const seenByLabel = seenByMembers.length
    ? seenByMembers.map((member) => member?.username || member?.name || member?.fullName || 'Someone').join(', ')
    : ''

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

  const getExtensionFromMime = (mime) => {
    const map = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'application/pdf': 'pdf',
    }
    return map[mime] || 'bin'
  }

  const getAttachmentName = (fallbackBase = 'attachment') => {
    const metaName = message.attachmentMeta?.name
    if (metaName) return metaName
    const mime = message.attachmentMeta?.mime || ''
    const ext = getExtensionFromMime(mime)
    return `${fallbackBase}.${ext}`
  }

  const handleDownload = (url, fileName) => {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSave = async (url, fileName) => {
    if (!window.showSaveFilePicker) {
      handleDownload(url, fileName)
      return
    }

    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const fileHandle = await window.showSaveFilePicker({ suggestedName: fileName })
      const writable = await fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn('Save failed, falling back to download:', error)
        handleDownload(url, fileName)
      }
    }
  }

  const isEditableMessage = () => {
    if (!isMine || message.messageType !== 'text') return false
    if (message.scheduledStatus === 'scheduled') return false
    const messageTime = message.sentAt || message.createdAt
    const timeDiff = Date.now() - new Date(messageTime).getTime()
    const fifteenMinutes = 15 * 60 * 1000
    return timeDiff < fifteenMinutes
  }

  // Determine message type and render accordingly
  const renderContent = () => {
    if (isScheduled) {
      const scheduledTime = message.scheduledFor
        ? new Date(message.scheduledFor).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
        : 'soon'

      return (
        <div className="scheduled-message-bubble">
          <Clock size={18} />
          <div className="scheduled-message-content">
            <span className="scheduled-message-title">Scheduled message</span>
            <span className="scheduled-message-time">Sending at {scheduledTime}</span>
          </div>
        </div>
      )
    }

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

    if (message.messageType === 'photo' || message.messageType === 'camera') {
      const fileName = getAttachmentName('photo')
      return (
        <div className="attachment-message attachment-message--photo attachment-message--whatsapp">
          <div className="attachment-media-wrap attachment-media-wrap--photo">
            <img src={message.content} alt="Shared attachment" className="attachment-photo attachment-photo--whatsapp" loading="lazy" />
            <div className="attachment-photo-overlay">
              <div className="attachment-photo-actions">
                <button className="attachment-action-btn attachment-action-btn--photo" title="Fullscreen" onClick={() => onOpenMedia && onOpenMedia(message)}>
                  <Maximize2 size={14} />
                </button>
                <button className="attachment-action-btn attachment-action-btn--photo" title="Download" onClick={() => handleDownload(message.content, fileName)}>
                  <Download size={14} />
                </button>
                <button className="attachment-action-btn attachment-action-btn--photo" title="Save" onClick={() => handleSave(message.content, fileName)}>
                  <Save size={14} />
                </button>
              </div>
              <div className="attachment-photo-footer">
                {isPinned && (
                  <span className="bubble-flag bubble-flag--pin bubble-flag--photo" title="Pinned">
                    <Pin size={11} />
                  </span>
                )}
                {isStarred && (
                  <span className="bubble-flag bubble-flag--star bubble-flag--photo" title="Starred">
                    <Star size={11} fill="currentColor" />
                  </span>
                )}
                <span className="attachment-photo-time">
                  {time}
                  {isMine && (
                    <span className="attachment-photo-tick" title={isScheduled ? 'Scheduled' : isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'}>
                      {isScheduled ? (
                        <Clock size={12} strokeWidth={2.2} />
                      ) : isRead ? (
                        <svg width="13" height="9" viewBox="0 0 16 11" fill="#53bdeb">
                          <path d="M11.071.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.97-5.97z"/>
                          <path d="M14.571.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-.392.207l1.392-1.39 4.44-6.377z"/>
                        </svg>
                      ) : isDelivered ? (
                        <svg width="13" height="9" viewBox="0 0 16 11" fill="#8696A0">
                          <path d="M11.071.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.97-5.97z"/>
                          <path d="M14.571.653a.75.75 0 0 1 1.06 1.06l-6.5 6.5a.75.75 0 0 1-.392.207l1.392-1.39 4.44-6.377z"/>
                        </svg>
                      ) : null}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (message.messageType === 'video') {
      const fileName = getAttachmentName('video')
      return (
        <div className="attachment-message attachment-message--video">
          <div className="attachment-media-wrap">
            <video src={message.content} controls className="attachment-video" preload="metadata" />
            <div className="attachment-actions">
              <button className="attachment-action-btn" title="Fullscreen" onClick={() => onOpenMedia && onOpenMedia(message)}>
                <Maximize2 size={14} />
              </button>
              <button className="attachment-action-btn" title="Download" onClick={() => handleDownload(message.content, fileName)}>
                <Download size={14} />
              </button>
              <button className="attachment-action-btn" title="Save" onClick={() => handleSave(message.content, fileName)}>
                <Save size={14} />
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (message.messageType === 'document') {
      const name = message.attachmentMeta?.name || 'document'
      return (
        <div className="attachment-message attachment-message--document">
          <span className="attachment-doc-icon">📄</span>
          <span className="attachment-doc-name">{name}</span>
          <div className="attachment-inline-actions">
            <button className="attachment-action-btn" title="Download" onClick={() => handleDownload(message.content, name)}>
              <Download size={14} />
            </button>
            <button className="attachment-action-btn" title="Save" onClick={() => handleSave(message.content, name)}>
              <Save size={14} />
            </button>
          </div>
        </div>
      )
    }

    if (message.messageType === 'location') {
      const label = message.attachmentMeta?.label || 'Open location'
      return (
        <a className="attachment-message attachment-message--location" href={message.content} target="_blank" rel="noreferrer">
          <span className="attachment-location-icon">📍</span>
          <span className="attachment-location-text">{label}</span>
        </a>
      )
    }

    // Default text message
    return <span className="bubble-text">{message.content}</span>
  }

  const showEdited = message.editedAt && !isScheduled
  const isPhotoMessage = message.messageType === 'photo' || message.messageType === 'camera'
  const bubbleClassName = isPhotoMessage
    ? 'bubble bubble--media'
    : `bubble ${isMine ? 'bubble--sent' : 'bubble--received'}`

  return (
    <>
      <motion.div
        className={`bubble-row ${isMine ? 'bubble-row--mine' : 'bubble-row--theirs'}`}
        initial={{ opacity: 0, x: isMine ? 24 : -24, scale: 0.92 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        layout
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="bubble-shell">
          <div className={bubbleClassName} onContextMenu={(event) => onContextMenu && onContextMenu(event, message)}>
            {renderContent()}
            <span className="bubble-meta">
            {isPinned && (
              <span className="bubble-flag bubble-flag--pin" title="Pinned">
                <Pin size={11} />
              </span>
            )}
            {isStarred && (
              <span className="bubble-flag bubble-flag--star" title="Starred">
                <Star size={11} fill="currentColor" />
              </span>
            )}
            {isEditableMessage() && (
              <button 
                className="edit-msg-btn" 
                onClick={() => onEditRequest && onEditRequest(message)}
                title="Edit message"
              >
                <Edit size={12} />
              </button>
            )}
            {!isMine && (
              <button
                className="forward-msg-btn"
                onClick={() => onForwardRequest && onForwardRequest(message)}
                title="Forward message"
              >
                <Share2 size={12} />
              </button>
            )}
            {showEdited && <span className="edited-label">edited</span>}
            <span className="bubble-time">{time}</span>
            {isMine && Array.isArray(message.seenBy) && message.seenBy.length > 0 && (
              <span className="bubble-seen-by" title={seenByLabel || 'Seen by group members'}>
                Seen by {message.seenBy.length}
              </span>
            )}
            {isMine && (
              <span className="bubble-tick" title={isScheduled ? 'Scheduled' : isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'}>
                {isScheduled ? (
                  <Clock size={14} strokeWidth={2.2} />
                ) : isRead ? (
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
          {(isHovering || menuActive) && (
            <button
              ref={arrowRef}
              className="bubble-menu-trigger"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const rect = arrowRef.current?.getBoundingClientRect()
                if (onMenuClick) {
                  onMenuClick(e, message, rect)
                }
              }}
              title="Message options"
            >
              <ChevronDown size={18} />
            </button>
          )}
        </div>
      </motion.div>
    </>
  )
}
