import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocket } from '../../context/SocketContext'
import { Send, Smile, Mic, Square, Clock, Check, X } from 'lucide-react'
import { voiceRecorder } from '../../lib/voiceRecorder'

const getDefaultScheduleValue = () => {
  const date = new Date(Date.now() + 15 * 60 * 1000)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export default function MessageInput({ onSend, selectedUser, editingMessage, onSubmitEdit, onCancelEdit }) {
  const [text, setText]            = useState('')
  const [typing, setTyping]        = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showSchedulePicker, setShowSchedulePicker] = useState(false)
  const [scheduledFor, setScheduledFor]       = useState(getDefaultScheduleValue())
  const [isRecording, setIsRecording]         = useState(false)
  const [recordingTime, setRecordingTime]     = useState(0)
  const [isSavingEdit, setIsSavingEdit]       = useState(false)
  const { socket }                 = useSocket()
  const typingTimer                = useRef(null)
  const inputRef                   = useRef(null)
  const recordingTimerRef          = useRef(null)
  const emojiPickerRef             = useRef(null)

  // Common emojis
  const commonEmojis = ['😀', '😂', '😍', '😢', '😡', '👍', '👎', '❤️', '🔥', '✨', '💯', '😎', '🤔', '😴', '🤮', '🎉', '😘', '💪', '🙏', '👏', '🎊', '🎈', '🌟', '💝']

  useEffect(() => { inputRef.current?.focus() }, [selectedUser])

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content || '')
      setShowEmojiPicker(false)
      setShowSchedulePicker(false)
      inputRef.current?.focus()
    }
  }, [editingMessage])

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      setRecordingTime(0)
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }
  }, [isRecording])

  // Pressing Enter while recording should finish and send the voice note.
  useEffect(() => {
    if (!isRecording) return

    const handleRecordingKeyDown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        handleStopVoiceRecord()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        // Cancel and discard the recording
        try { voiceRecorder.cancelRecording() } catch (e) { /* ignore */ }
        setIsRecording(false)
      }
    }

    window.addEventListener('keydown', handleRecordingKeyDown)
    return () => window.removeEventListener('keydown', handleRecordingKeyDown)
  }, [isRecording])

  // Global Escape handler to close pickers when not recording
  useEffect(() => {
    const handleGlobalEscape = (event) => {
      if (event.key === 'Escape') {
        if (isRecording) return // handled by recording handler
        setShowEmojiPicker(false)
        setShowSchedulePicker(false)
      }
    }
    window.addEventListener('keydown', handleGlobalEscape)
    return () => window.removeEventListener('keydown', handleGlobalEscape)
  }, [isRecording])

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

  const handleSend = (content, messageType = 'text', metadata = {}) => {
    if (!content || content.toString().trim() === '') return
    onSend(content, messageType, metadata)
    setText('')
    setShowEmojiPicker(false)
    setShowSchedulePicker(false)
    clearTimeout(typingTimer.current)
    if (typing && socket && selectedUser) {
      setTyping(false)
      socket.emit('stopTyping', { to: selectedUser._id })
    }
  }

  const handleScheduleSend = () => {
    if (!text.trim()) return
    const scheduledDate = new Date(scheduledFor)
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) return
    handleSend(text, 'text', { scheduledFor: scheduledDate.toISOString() })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (editingMessage) {
        handleEditSave()
        return
      }
      handleSend(text)
    }
  }

  const handleEditSave = async () => {
    if (!editingMessage || !text.trim()) return
    if (text === editingMessage.content) {
      onCancelEdit && onCancelEdit()
      return
    }

    setIsSavingEdit(true)
    try {
      await onSubmitEdit?.(editingMessage._id, text)
      setText('')
      onCancelEdit && onCancelEdit()
    } catch (err) {
      console.error('Edit message failed:', err)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const addEmoji = (emoji) => {
    setText(prev => prev + emoji)
    inputRef.current?.focus()
  }

  const handleEmojiSend = (emoji) => {
    handleSend(emoji, 'emoji')
  }

  const handleStartVoiceRecord = async () => {
    try {
      setIsRecording(true)
      await voiceRecorder.startRecording(
        (data) => {
          setIsRecording(false)
          handleSend(data.voiceData, 'voice', { duration: data.voiceDuration })
        },
        (error) => {
          setIsRecording(false)
          console.error('Recording error:', error)
        }
      )
    } catch (error) {
      setIsRecording(false)
      console.error('Failed to start recording:', error)
    }
  }

  const handleStopVoiceRecord = () => {
    voiceRecorder.stopRecording()
    setIsRecording(false)
  }

  const hasText = text.trim().length > 0
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="message-input-bar">
      {isRecording ? (
        <div className="recording-indicator">
          <motion.div
            className="recording-dot"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
          <span className="recording-time">{formatTime(recordingTime)}</span>
        </div>
      ) : (
        <>
          {editingMessage && (
            <div className="editing-banner">
              <div className="editing-banner-text">
                <span className="editing-banner-title">Editing message</span>
                <span className="editing-banner-preview">{editingMessage.content}</span>
              </div>
              <button className="editing-banner-cancel" onClick={() => { onCancelEdit && onCancelEdit(); setText('') }} title="Cancel edit">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="input-actions">
            <motion.button
              className="action-btn emoji-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Add emoji"
            >
              <Smile size={20} />
            </motion.button>
          </div>

          <div className="emoji-picker-wrapper" ref={emojiPickerRef}>
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  className="emoji-picker"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="emoji-grid">
                    {commonEmojis.map((emoji, idx) => (
                      <motion.button
                        key={idx}
                        className="emoji-item"
                        onClick={() => handleEmojiSend(emoji)}
                        whileHover={{ scale: 1.3 }}
                        whileTap={{ scale: 0.8 }}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                  <div className="emoji-input-add">
                    <input
                      type="text"
                      className="emoji-text-input"
                      placeholder="Search or add text"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleEmojiSend(e.target.value)
                          e.target.value = ''
                        }
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <textarea
            ref={inputRef} id="message-input" className="message-textarea"
            placeholder={editingMessage ? 'Edit your message' : 'Type a message'} value={text}
            onChange={handleChange} onKeyDown={handleKeyDown} rows={1}
          />

          <div className="input-actions">
            {hasText || editingMessage ? (
              <>
                {!editingMessage && (
                  <div className="schedule-wrap">
                    <motion.button
                      className="action-btn schedule-btn"
                      onClick={() => {
                        setScheduledFor(getDefaultScheduleValue())
                        setShowSchedulePicker(prev => !prev)
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Schedule message"
                    >
                      <Clock size={18} />
                    </motion.button>

                    <AnimatePresence>
                      {showSchedulePicker && (
                        <motion.div
                          className="schedule-popover"
                          initial={{ opacity: 0, y: 8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                        >
                          <label className="schedule-label" htmlFor="schedule-time">Send later</label>
                          <input
                            id="schedule-time"
                            type="datetime-local"
                            className="schedule-input"
                            value={scheduledFor}
                            onChange={(e) => setScheduledFor(e.target.value)}
                          />
                          <div className="schedule-actions">
                            <button className="schedule-cancel" onClick={() => setShowSchedulePicker(false)} type="button">
                              Cancel
                            </button>
                            <button className="schedule-confirm" onClick={handleScheduleSend} type="button">
                              Schedule
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {editingMessage ? (
                  <>
                    <motion.button
                      className="action-btn edit-cancel-btn"
                      onClick={() => { onCancelEdit && onCancelEdit(); setText('') }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.9 }}
                      title="Cancel edit"
                    >
                      <X size={18} />
                    </motion.button>
                    <motion.button
                      id="send-btn"
                      className="action-btn send-btn send-btn--active"
                      onClick={handleEditSave}
                      whileHover={{ scale: 1.12 }}
                      whileTap={{ scale: 0.88 }}
                      disabled={isSavingEdit || !text.trim()}
                      title="Save edit"
                    >
                      <Check size={18} />
                    </motion.button>
                  </>
                ) : (
                  <motion.button
                    id="send-btn"
                    className="action-btn send-btn send-btn--active"
                    onClick={() => handleSend(text)}
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.88, rotate: 15 }}
                  >
                    <Send size={18} />
                  </motion.button>
                )}
              </>
            ) : (
              <motion.button
                className="action-btn voice-btn"
                onMouseDown={handleStartVoiceRecord}
                onMouseUp={handleStopVoiceRecord}
                onTouchStart={handleStartVoiceRecord}
                onTouchEnd={handleStopVoiceRecord}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="Hold to record voice"
              >
                <Mic size={20} />
              </motion.button>
            )}
          </div>
        </>
      )}

      {isRecording && (
        <motion.button
          className="action-btn stop-record-btn"
          onClick={handleStopVoiceRecord}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Square size={16} fill="currentColor" />
        </motion.button>
      )}
    </div>
  )
}
