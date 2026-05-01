const jwt  = require('jsonwebtoken')
const User = require('../models/User')
const Message = require('../models/Message')
const Group = require('../models/Group')
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
    scheduledStatus: message.scheduledStatus || 'sent',
    sentAt: message.sentAt || null,
    scheduledFor: message.scheduledFor || null,
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

    // Join all group rooms for this user
    try {
      const groups = await Group.find({ members: socket.user._id }).select('_id').lean()
      groups.forEach((group) => {
        socket.join(`group:${group._id.toString()}`)
      })
    } catch (error) {
      console.error('Failed to join group rooms:', error.message)
    }

    // ── sendMessage ─────────────────────────────────────────
    socket.on('sendMessage', async (data, callback) => {
      try {
        const { to, encryptedMessage, iv, encryptedKey, messageType = 'text', voiceDuration = null, scheduledFor = null, attachmentMeta = null } = data

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

        const scheduledDate = scheduledFor ? new Date(scheduledFor) : null
        const isScheduled = scheduledDate && !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now()

        // Save to DB — use content field for plaintext, keep legacy fields if present
        const message = await Message.create({
          sender:   userId,
          receiver: to,
          encryptedMessage,
          iv,
          encryptedKey: encryptedKey || null,
          messageType,
          voiceDuration: messageType === 'voice' ? voiceDuration : null,
          attachmentMeta: attachmentMeta || null,
          scheduledFor: isScheduled ? scheduledDate : null,
          scheduledStatus: isScheduled ? 'scheduled' : 'sent',
          sentAt: isScheduled ? null : new Date(),
        })

        await message.populate('sender',   'username avatarColor')
        await message.populate('receiver', 'username avatarColor')

        const receiverOnline = getSocketIds(to).size > 0
        if (!isScheduled && receiverOnline) {
          message.deliveredAt = new Date()
          await message.save()
        }

        const messageObj = message.toObject()

        if (!isScheduled) {
          await sendPushNotification({ receiver, sender: message.sender, message: messageObj })
        }

        // Deliver to receiver's room immediately only for non-scheduled messages
        if (!isScheduled) {
          socket.to(to).emit('newMessage', messageObj)

          if (receiverOnline) {
            emitMessageStatus(io, messageObj)
          }
        }

        // Acknowledge sender
        callback?.({ success: true, message: messageObj })
      } catch (error) {
        console.error('Socket sendMessage error:', error.message)
        callback?.({ success: false, error: 'Failed to send message.' })
      }
    })

    // ── sendGroupMessage ───────────────────────────────────
    socket.on('sendGroupMessage', async (data, callback) => {
      try {
        const { groupId, content, messageType = 'text', voiceDuration = null, attachmentMeta = null } = data || {}
        if (!groupId || !content?.toString?.().trim?.()) {
          return callback?.({ success: false, error: 'Invalid group message data.' })
        }

        const group = await Group.findById(groupId).select('_id members')
        if (!group) {
          return callback?.({ success: false, error: 'Group not found.' })
        }

        const isMember = group.members.some((memberId) => memberId.toString() === userId)
        if (!isMember) {
          return callback?.({ success: false, error: 'You are not a member of this group.' })
        }

        const message = await Message.create({
          sender: userId,
          receiver: null,
          group: groupId,
          encryptedMessage: content,
          iv: 'group',
          encryptedKey: null,
          messageType,
          voiceDuration: messageType === 'voice' ? voiceDuration : null,
          attachmentMeta: attachmentMeta || null,
          sentAt: new Date(),
          scheduledStatus: 'sent',
        })

        await message.populate('sender', 'username avatarColor avatar')

        const messageObj = message.toObject()

        io.to(`group:${groupId.toString()}`).emit('newMessage', messageObj)

        callback?.({ success: true, message: messageObj })
      } catch (error) {
        console.error('Socket sendGroupMessage error:', error.message)
        callback?.({ success: false, error: 'Failed to send group message.' })
      }
    })

    // ── Typing indicators ────────────────────────────────────
    socket.on('typing', ({ to, groupId }) => {
      if (groupId) {
        socket.to(`group:${groupId}`).emit('userTyping', { from: userId, groupId })
        return
      }
      if (to) socket.to(to).emit('userTyping', { from: userId })
    })

    socket.on('stopTyping', ({ to, groupId }) => {
      if (groupId) {
        socket.to(`group:${groupId}`).emit('userStoppedTyping', { from: userId, groupId })
        return
      }
      if (to) socket.to(to).emit('userStoppedTyping', { from: userId })
    })

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

    // ── forwardMessage ────────────────────────────────────────
    socket.on('forwardMessage', async (data, callback) => {
      try {
        const { messageId, to, encryptedMessage, iv, encryptedKey } = data

        if (!messageId || !to || !encryptedMessage) {
          return callback?.({ success: false, error: 'Invalid forward data.' })
        }

        if (to === userId) {
          return callback?.({ success: false, error: 'Cannot forward a message to yourself.' })
        }

        const originalMessage = await Message.findById(messageId)
        if (!originalMessage) {
          return callback?.({ success: false, error: 'Original message not found.' })
        }

        const receiver = await User.findById(to).select('username isOnline pushTokens')
        if (!receiver) {
          return callback?.({ success: false, error: 'Recipient not found.' })
        }

        // Create forwarded message with link to original
        const forwardedMessage = await Message.create({
          sender: userId,
          receiver: to,
          encryptedMessage,
          iv,
          encryptedKey: encryptedKey || null,
          messageType: originalMessage.messageType,
          voiceDuration: originalMessage.voiceDuration || null,
          attachmentMeta: originalMessage.attachmentMeta || null,
          forwardedFrom: originalMessage._id,
          isForwarded: true,
          sentAt: new Date(),
          deliveredAt: getSocketIds(to).size > 0 ? new Date() : null,
        })

        await forwardedMessage.populate('sender', 'username avatarColor')
        await forwardedMessage.populate('receiver', 'username avatarColor')
        await forwardedMessage.populate('forwardedFrom')

        const messageObj = forwardedMessage.toObject()

        // Deliver to receiver in real-time
        socket.to(to.toString()).emit('newMessage', messageObj)

        // Emit status update
        if (getSocketIds(to).size > 0) {
          emitMessageStatus(io, messageObj)
        }

        // Send push notification
        await sendPushNotification({ receiver, sender: forwardedMessage.sender, message: messageObj })

        callback?.({ success: true, message: messageObj })
      } catch (error) {
        console.error('Socket forwardMessage error:', error.message)
        callback?.({ success: false, error: 'Failed to forward message.' })
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
