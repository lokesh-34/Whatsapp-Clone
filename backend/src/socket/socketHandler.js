const jwt  = require('jsonwebtoken')
const User = require('../models/User')
const Message = require('../models/Message')
const { sendPushNotification } = require('../services/pushNotifications')

// userId → Set<socketId>  (one user may have multiple tabs)
const onlineUsers = new Map()

const getSocketIds    = (userId) => onlineUsers.get(userId.toString()) || new Set()
const getOnlineUserIds = ()      => Array.from(onlineUsers.keys())

const emitMessageStatus = (io, message) => {
  const payload = {
    messageId: message._id,
    senderId: message.sender?._id || message.sender,
    receiverId: message.receiver?._id || message.receiver,
    deliveredAt: message.deliveredAt || null,
    readAt: message.readAt || null,
    read: !!message.read,
  }

  io.to(payload.senderId.toString()).emit('messageStatusUpdated', payload)
}

const socketHandler = (io) => {
  // ── Auth middleware ─────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (!token) return next(new Error('No token provided.'))
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user    = await User.findById(decoded.id).select('-password')
      if (!user) return next(new Error('User not found.'))
      socket.user = user
      next()
    } catch {
      next(new Error('Invalid token.'))
    }
  })

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString()
    console.log(`🟢 User connected: ${socket.user.username} (${socket.id})`)

    // Register socket
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set())
    onlineUsers.get(userId).add(socket.id)

    await User.findByIdAndUpdate(userId, { isOnline: true })
    io.emit('onlineUsers', getOnlineUserIds())

    socket.join(userId)

    // ── sendMessage ─────────────────────────────────────────
    socket.on('sendMessage', async (data, callback) => {
      try {
        const { to, encryptedMessage, iv, encryptedKey, messageType = 'text', voiceDuration = null } = data

        if (!to || !encryptedMessage) {
          return callback?.({ success: false, error: 'Invalid message data.' })
        }
        if (to === userId) {
          return callback?.({ success: false, error: 'Cannot send a message to yourself.' })
        }

        const receiver = await User.findById(to).select('username isOnline pushTokens')
        if (!receiver) {
          return callback?.({ success: false, error: 'Recipient not found.' })
        }

        // Save to DB — use content field for plaintext, keep legacy fields if present
        const message = await Message.create({
          sender:   userId,
          receiver: to,
          encryptedMessage,
          iv,
          encryptedKey: encryptedKey || null,
          messageType,
          voiceDuration: messageType === 'voice' ? voiceDuration : null,
        })

        await message.populate('sender',   'username avatarColor')
        await message.populate('receiver', 'username avatarColor')

        const receiverOnline = getSocketIds(to).size > 0
        if (receiverOnline) {
          message.deliveredAt = new Date()
          await message.save()
        }

        const messageObj = message.toObject()

        await sendPushNotification({ receiver, sender: message.sender, message: messageObj })

        // Deliver to receiver's room
        socket.to(to).emit('newMessage', messageObj)

        if (receiverOnline) {
          emitMessageStatus(io, messageObj)
        }

        // Acknowledge sender
        callback?.({ success: true, message: messageObj })
      } catch (error) {
        console.error('Socket sendMessage error:', error.message)
        callback?.({ success: false, error: 'Failed to send message.' })
      }
    })

    // ── Typing indicators ────────────────────────────────────
    socket.on('typing',     ({ to }) => to && socket.to(to).emit('userTyping',        { from: userId }))
    socket.on('stopTyping', ({ to }) => to && socket.to(to).emit('userStoppedTyping', { from: userId }))

    socket.on('messagesRead', async ({ from }) => {
      try {
        if (!from) return
        const now = new Date()
        const result = await Message.updateMany(
          { sender: from, receiver: userId, read: false },
          { $set: { read: true, readAt: now, deliveredAt: now } }
        )

        if (result.modifiedCount > 0) {
          io.to(from.toString()).emit('messageStatusUpdated', {
            senderId: from,
            receiverId: userId,
            read: true,
            readAt: now,
            deliveredAt: now,
          })
        }
      } catch (error) {
        console.error('messagesRead error:', error.message)
      }
    })

    // ── Disconnect ───────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔴 User disconnected: ${socket.user.username} (${socket.id})`)
      const sockets = onlineUsers.get(userId)
      if (sockets) {
        sockets.delete(socket.id)
        if (sockets.size === 0) {
          onlineUsers.delete(userId)
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() })
          io.emit('onlineUsers', getOnlineUserIds())
        }
      }
    })
  })
}

module.exports = socketHandler
