import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Download, Save, Share2, X, Plus, Minus, Pin, Star, Trash2 } from 'lucide-react'
import MessageBubble from '../MessageBubble'
import ForwardDialog from '../ForwardDialog'
import { getUsers, forwardMessage, togglePinMessage, toggleStarMessage, deleteMessage } from '../../api'
import e2ee from '../../lib/e2ee'

export default function MessageList({ messages, currentUser, loading, onEditRequest }) {
  const bottomRef = useRef(null)
  const currentUserId = currentUser?._id?.toString?.() || currentUser?._id || currentUser?.id
  const [viewerIndex, setViewerIndex] = useState(-1)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  const mediaMessages = useMemo(() => {
    return messages.filter((msg) => msg.messageType === 'photo' || msg.messageType === 'camera' || msg.messageType === 'video')
  }, [messages])

  const activeMedia = viewerIndex >= 0 ? mediaMessages[viewerIndex] : null
  const [forwardOpen, setForwardOpen] = useState(false)
  const [forwardMsg, setForwardMsg] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [forwardLoading, setForwardLoading] = useState(false)
  const [menuState, setMenuState] = useState({ open: false, x: 0, y: 0, message: null })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handleOutsideClick = () => closeMenu()
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!activeMedia) return

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setViewerIndex(-1)
      if (event.key === 'ArrowRight' && mediaMessages.length > 1) {
        setViewerIndex((idx) => (idx + 1) % mediaMessages.length)
      }
      if (event.key === 'ArrowLeft' && mediaMessages.length > 1) {
        setViewerIndex((idx) => (idx <= 0 ? mediaMessages.length - 1 : idx - 1))
      }
      if (event.key === '+' || event.key === '=') setZoom((z) => Math.min(4, z + 0.25))
      if (event.key === '-') setZoom((z) => Math.max(1, z - 0.25))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeMedia, mediaMessages.length])

  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [viewerIndex])

  const getExtensionFromMime = (mime) => {
    const map = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
    }
    return map[mime] || 'bin'
  }

  const getFileName = (msg) => {
    if (!msg) return 'attachment.bin'
    if (msg.attachmentMeta?.name) return msg.attachmentMeta.name

    const mime = msg.attachmentMeta?.mime || ''
    const ext = getExtensionFromMime(mime)
    if (msg.messageType === 'video') return `video.${ext}`
    return `photo.${ext}`
  }

  const downloadMedia = (src, fileName) => {
    const link = document.createElement('a')
    link.href = src
    link.download = fileName
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const saveMedia = async (src, fileName) => {
    if (!window.showSaveFilePicker) {
      downloadMedia(src, fileName)
      return
    }
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const handle = await window.showSaveFilePicker({ suggestedName: fileName })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
    } catch (error) {
      if (error?.name !== 'AbortError') downloadMedia(src, fileName)
    }
  }

  const saveToGalleryMobile = async (msg) => {
    if (!msg) return
    const fileName = getFileName(msg)

    try {
      const res = await fetch(msg.content)
      const blob = await res.blob()
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Save media',
          text: 'Save to Gallery',
        })
        return
      }
    } catch (error) {
      console.warn('Native share unavailable:', error)
    }

    downloadMedia(msg.content, fileName)
  }

  const openViewerForMessage = (msg) => {
    const idx = mediaMessages.findIndex((item) => item._id === msg._id)
    if (idx >= 0) setViewerIndex(idx)
  }

  const openForwardDialog = async (msg) => {
    setForwardMsg(msg)
    setForwardOpen(true)
    if (!allUsers || allUsers.length === 0) {
      try {
        const { data } = await getUsers()
        setAllUsers(data.users || [])
      } catch (err) {
        console.error('Failed to load users for forward dialog', err)
      }
    }
  }

  const closeForwardDialog = () => {
    setForwardOpen(false)
    setForwardMsg(null)
  }

  const closeMenu = () => setMenuState({ open: false, x: 0, y: 0, message: null })

  useEffect(() => {
    const onClose = () => closeMenu()
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [])

  const openContextMenu = (event, message) => {
    event.preventDefault()
    setMenuState({ open: true, x: event.clientX, y: event.clientY, message })
  }

  const getBubbleState = (message) => ({
    pinned: Boolean(message?.pinnedBy?.some?.((id) => (id?._id || id)?.toString?.() === currentUserId)),
    starred: Boolean(message?.starredBy?.some?.((id) => (id?._id || id)?.toString?.() === currentUserId)),
  })

  const handleForward = async (toUserId, message) => {
    setForwardLoading(true)
    try {
      const payload = await e2ee.encryptForChat(currentUser._id, toUserId, message.content)
      await forwardMessage(message._id, { to: toUserId, ...payload })
    } catch (err) {
      console.error('Forward failed:', err)
      throw err
    } finally {
      setForwardLoading(false)
    }
  }

  const patchMessageInList = (messageId, updater) => {
    setMessages((prev) => prev.map((msg) => (msg._id === messageId ? updater(msg) : msg)))
  }

  const patchRecentChat = (messageId, updater) => {
    if (!messageId) return
    if (typeof window === 'undefined') return
    // recent chats are maintained in parent; this handler keeps the open thread accurate
  }

  const handlePinToggle = async () => {
    const message = menuState.message
    if (!message) return
    const { data } = await togglePinMessage(message._id)
    patchMessageInList(message._id, (msg) => ({ ...msg, pinnedBy: data.message.pinnedBy || [] }))
    closeMenu()
  }

  const handleStarToggle = async () => {
    const message = menuState.message
    if (!message) return
    const { data } = await toggleStarMessage(message._id)
    patchMessageInList(message._id, (msg) => ({ ...msg, starredBy: data.message.starredBy || [] }))
    closeMenu()
  }

  const handleDelete = async (scope = 'me') => {
    const message = menuState.message
    if (!message) return
    const { data } = await deleteMessage(message._id, { scope })
    if (data?.data?.deletedForEveryone) {
      setMessages((prev) => prev.filter((msg) => msg._id !== message._id))
    } else {
      setMessages((prev) => prev.filter((msg) => msg._id !== message._id))
    }
    closeMenu()
  }

  const goPrev = () => {
    if (mediaMessages.length < 2) return
    setViewerIndex((idx) => (idx <= 0 ? mediaMessages.length - 1 : idx - 1))
  }

  const goNext = () => {
    if (mediaMessages.length < 2) return
    setViewerIndex((idx) => (idx + 1) % mediaMessages.length)
  }

  const onImageWheel = (event) => {
    if (!activeMedia || activeMedia.messageType === 'video') return
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.12 : 0.12
    setZoom((z) => Math.min(4, Math.max(1, z + delta)))
  }

  const startPan = (event) => {
    if (!activeMedia || activeMedia.messageType === 'video' || zoom <= 1) return
    setIsPanning(true)
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    }
  }

  const movePan = (event) => {
    if (!isPanning) return
    const dx = event.clientX - panStartRef.current.x
    const dy = event.clientY - panStartRef.current.y
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy })
  }

  const stopPan = () => setIsPanning(false)

  const zoomIn = () => setZoom((z) => Math.min(4, z + 0.2))
  const zoomOut = () => setZoom((z) => Math.max(1, z - 0.2))
  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

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
              isMine={(msg.sender?._id || msg.sender)?.toString?.() === currentUserId}
              onEditRequest={onEditRequest}
              onOpenMedia={openViewerForMessage}
              onForwardRequest={(m) => openForwardDialog(m)}
              onContextMenu={openContextMenu}
              isPinned={Boolean(msg.pinnedBy?.some?.((id) => (id?._id || id)?.toString?.() === currentUserId))}
              isStarred={Boolean(msg.starredBy?.some?.((id) => (id?._id || id)?.toString?.() === currentUserId))}
            />
          ))}
        </AnimatePresence>
      )}
      <div ref={bottomRef} />

      {menuState.open && menuState.message && (
        <div
          className="message-context-menu"
          style={{ left: menuState.x, top: menuState.y }}
          onMouseLeave={closeMenu}
        >
          <button className="message-context-menu-item" onClick={() => { openForwardDialog(menuState.message); closeMenu() }}>
            <Share2 size={14} /> Forward
          </button>
          <button className="message-context-menu-item" onClick={handlePinToggle}>
            <Pin size={14} /> {getBubbleState(menuState.message).pinned ? 'Unpin' : 'Pin'}
          </button>
          <button className="message-context-menu-item" onClick={handleStarToggle}>
            <Star size={14} /> {getBubbleState(menuState.message).starred ? 'Unstar' : 'Star'}
          </button>
          <button className="message-context-menu-item message-context-menu-item--danger" onClick={() => handleDelete('me')}>
            <Trash2 size={14} /> Delete for me
          </button>
          {menuState.message?.sender?._id?.toString?.() === currentUserId && (
            <button className="message-context-menu-item message-context-menu-item--danger" onClick={() => handleDelete('everyone')}>
              <Trash2 size={14} /> Delete for everyone
            </button>
          )}
        </div>
      )}

      <ForwardDialog
        message={forwardMsg}
        open={forwardOpen}
        onClose={closeForwardDialog}
        onForward={handleForward}
        currentUser={currentUser}
        allUsers={allUsers}
      />

      {activeMedia && (
        <div className="media-preview-overlay" onClick={() => setViewerIndex(-1)}>
          <div className="media-preview-card" onClick={(e) => e.stopPropagation()}>
            <div className="media-preview-header">
              <span className="media-preview-name">{getFileName(activeMedia)}</span>
              <div className="media-preview-actions">
                {activeMedia.messageType !== 'video' && (
                  <>
                    <button className="attachment-action-btn" title="Zoom out" onClick={zoomOut}>
                      <Minus size={14} />
                    </button>
                    <button className="attachment-action-btn" title="Zoom in" onClick={zoomIn}>
                      <Plus size={14} />
                    </button>
                    <button className="attachment-action-btn" title="Reset" onClick={resetView}>
                      1x
                    </button>
                  </>
                )}
                <button className="attachment-action-btn" title="Download" onClick={() => downloadMedia(activeMedia.content, getFileName(activeMedia))}>
                  <Download size={14} />
                </button>
                <button className="attachment-action-btn" title="Save" onClick={() => saveMedia(activeMedia.content, getFileName(activeMedia))}>
                  <Save size={14} />
                </button>
                <button className="attachment-action-btn" title="Save to Gallery" onClick={() => saveToGalleryMobile(activeMedia)}>
                  <Share2 size={14} />
                </button>
                <button className="attachment-action-btn" title="Close" onClick={() => setViewerIndex(-1)}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="media-preview-body" onWheel={onImageWheel} onMouseMove={movePan} onMouseUp={stopPan} onMouseLeave={stopPan}>
              {mediaMessages.length > 1 && (
                <button className="media-nav-btn media-nav-btn--left" onClick={goPrev} title="Previous">
                  <ChevronLeft size={20} />
                </button>
              )}

              {activeMedia.messageType === 'video' ? (
                <video src={activeMedia.content} controls autoPlay className="media-preview-video" />
              ) : (
                <img
                  src={activeMedia.content}
                  alt={getFileName(activeMedia)}
                  className={`media-preview-image ${zoom > 1 ? 'media-preview-image--pan' : ''}`}
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                  onMouseDown={startPan}
                  draggable={false}
                />
              )}

              {mediaMessages.length > 1 && (
                <button className="media-nav-btn media-nav-btn--right" onClick={goNext} title="Next">
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
