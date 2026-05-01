const { validationResult } = require('express-validator')
const Message = require('../models/Message')
const User    = require('../models/User')
const { sendPushNotification } = require('../services/pushNotifications')
const { getIO } = require('../socket/io')

const toIdString = (value) => value?.toString?.() || String(value)
const includesUserId = (ids, userId) => (ids || []).some((id) => toIdString(id) === toIdString(userId))

// ── GET /api/messages/conversations ─────────────────────────
// Returns all users this person has chatted with, sorted by last message
const getConversations = async (req, res, next) => {
  try {
    const myId = req.user._id

    const conversations = await Message.aggregate([
      // All messages involving me
      { $match: { $or: [{ sender: myId }, { receiver: myId }], deletedFor: { $ne: myId } } },

      // Sort so $last gives the most recent
      { $sort: { createdAt: 1 } },

      // Group by the "other" user
      {
        $group: {
          _id: {
            $cond: [{ $eq: ['$sender', myId] }, '$receiver', '$sender'],
          },
          lastMessage: { $last: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', myId] }, { $eq: ['$read', false] }] },
                1, 0,
              ],
            },
          },
        },
      },

      // Newest conversation first
      { $sort: { 'lastMessage.createdAt': -1 } },

      // Fetch the other user's info
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },

      {
        $project: {
          _id: 0,
          user: {
            _id:         '$user._id',
            username:    '$user.username',
            email:       '$user.email',
            avatarColor: '$user.avatarColor',
            avatar:      '$user.avatar',
            isOnline:    '$user.isOnline',
            lastSeen:    '$user.lastSeen',
          },
          lastMessage: {
            _id: '$lastMessage._id',
            encryptedMessage: '$lastMessage.encryptedMessage',
            iv: '$lastMessage.iv',
            encryptedKey: '$lastMessage.encryptedKey',
            deliveredAt: '$lastMessage.deliveredAt',
            readAt: '$lastMessage.readAt',
            createdAt: '$lastMessage.createdAt',
            sentAt: '$lastMessage.sentAt',
            scheduledFor: '$lastMessage.scheduledFor',
            scheduledStatus: '$lastMessage.scheduledStatus',
            sender: '$lastMessage.sender',
            read: '$lastMessage.read',
            messageType: '$lastMessage.messageType',
            voiceDuration: '$lastMessage.voiceDuration',
            attachmentMeta: '$lastMessage.attachmentMeta',
            editedAt: '$lastMessage.editedAt',
            pinnedBy: '$lastMessage.pinnedBy',
            starredBy: '$lastMessage.starredBy',
            deletedFor: '$lastMessage.deletedFor',
          },
          unreadCount: 1,
        },
      },
    ])

    res.status(200).json({ success: true, conversations })
  } catch (error) {
    next(error)
  }
}

// ── GET /api/messages/:userId ────────────────────────────────
const getMessages = async (req, res, next) => {
  try {
    const { userId } = req.params
    const myId       = req.user._id

    const otherUser = await User.findById(userId)
    if (!otherUser) return res.status(404).json({ success: false, message: 'User not found.' })

    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: userId },
        { sender: userId, receiver: myId },
      ],
      deletedFor: { $ne: myId },
    })
      .populate('sender',   'username avatarColor avatar')
      .populate('receiver', 'username avatarColor avatar')
      .sort({ createdAt: 1 })

    // Mark received messages as read
    await Message.updateMany(
      { sender: userId, receiver: myId, read: false },
      { $set: { read: true, readAt: new Date(), deliveredAt: new Date() } }
    )

    res.status(200).json({ success: true, count: messages.length, messages })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/messages/:userId ───────────────────────────────
// HTTP fallback when socket is unavailable
const sendMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: errors.array()[0].msg })

    const { userId }  = req.params
    const { encryptedMessage, iv, encryptedKey, messageType = 'text', voiceDuration = null, scheduledFor = null, attachmentMeta = null } = req.body
    const senderId    = req.user._id

    if (userId === senderId.toString())
      return res.status(400).json({ success: false, message: 'You cannot send a message to yourself.' })

    const receiver = await User.findById(userId).select('username isOnline pushTokens')
    if (!receiver) return res.status(404).json({ success: false, message: 'Recipient not found.' })

    if (!encryptedMessage)
      return res.status(400).json({ success: false, message: 'Encrypted message is required.' })

    const scheduledDate = scheduledFor ? new Date(scheduledFor) : null
    const isScheduled = scheduledDate && !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now()

    const message = await Message.create({
      sender:   senderId,
      receiver: userId,
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

    await message.populate('sender',   'username avatarColor avatar')
    await message.populate('receiver', 'username avatarColor avatar')

    if (!isScheduled) {
      await sendPushNotification({ receiver, sender: message.sender, message })
    }

    const messageObj = message.toObject()

    res.status(201).json({ success: true, message: messageObj })
  } catch (error) {
    next(error)
  }
}

// ── GET /api/messages/unread ─────────────────────────────────
const getUnreadCounts = async (req, res, next) => {
  try {
    const myId = req.user._id
    const unreadCounts = await Message.aggregate([
      { $match: { receiver: myId, read: false, deletedFor: { $ne: myId } } },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
    ])
    const countsMap = {}
    unreadCounts.forEach(item => { countsMap[item._id.toString()] = item.count })
    res.status(200).json({ success: true, unreadCounts: countsMap })
  } catch (error) {
    next(error)
  }
}

// ── GET /api/messages/:userId/scheduled ───────────────────
const getScheduledMessages = async (req, res, next) => {
  try {
    const { userId } = req.params
    const myId = req.user._id

    const otherUser = await User.findById(userId)
    if (!otherUser) return res.status(404).json({ success: false, message: 'User not found.' })

    const messages = await Message.find({ sender: myId, receiver: userId, scheduledStatus: 'scheduled' })
      .populate('sender',   'username avatarColor avatar')
      .populate('receiver', 'username avatarColor avatar')
      .sort({ scheduledFor: 1 })

    res.status(200).json({ success: true, count: messages.length, messages })
  } catch (error) {
    next(error)
  }
}

// ── GET /api/messages/starred ───────────────────────────────
const getStarredMessages = async (req, res, next) => {
  try {
    const myId = req.user._id

    const messages = await Message.find({
      $or: [
        { sender: myId },
        { receiver: myId },
      ],
      starredBy: myId,
      deletedFor: { $ne: myId },
    })
      .populate('sender', 'username avatarColor avatar')
      .populate('receiver', 'username avatarColor avatar')
      .sort({ createdAt: -1 })

    res.status(200).json({ success: true, count: messages.length, messages })
  } catch (error) {
    next(error)
  }
}

// ── DELETE /api/messages/scheduled/:messageId ────────────
const cancelScheduledMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params
    const myId = req.user._id

    const message = await Message.findById(messageId)
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' })

    if (message.sender.toString() !== myId.toString())
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this message.' })

    if (message.scheduledStatus !== 'scheduled')
      return res.status(400).json({ success: false, message: 'Message is not scheduled or already processed.' })

    message.scheduledStatus = 'cancelled'
    await message.save()

    // Emit socket updates if Socket.IO is available
    try {
      const io = getIO()
      const payload = {
        messageId: message._id,
        senderId: message.sender,
        receiverId: message.receiver,
        scheduledStatus: message.scheduledStatus,
        scheduledFor: message.scheduledFor || null,
      }
      if (io) {
        io.to(message.sender.toString()).emit('messageStatusUpdated', payload)
        io.to(message.receiver.toString()).emit('messageStatusUpdated', payload)
        io.to(message.sender.toString()).emit('messageCancelled', payload)
        io.to(message.receiver.toString()).emit('messageCancelled', payload)
      }
    } catch (emitErr) {
      console.error('Failed to emit cancellation event:', emitErr.message)
    }

    res.status(200).json({ success: true, message: 'Scheduled message cancelled.', data: { messageId: message._id } })
  } catch (error) {
    next(error)
  }
}

module.exports = { getConversations, getMessages, sendMessage, getUnreadCounts, getScheduledMessages, getStarredMessages, cancelScheduledMessage }

// ── PUT /api/messages/:messageId/edit ─────────────────────
const editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params
    const { encryptedMessage, iv, encryptedKey } = req.body
    const myId = req.user._id
    const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000 // 15 minutes

    const message = await Message.findById(messageId)
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' })

    if (message.sender.toString() !== myId.toString())
      return res.status(403).json({ success: false, message: 'Only the sender can edit this message.' })

    // Check if message is a text message (voice/emoji cannot be edited)
    if (message.messageType !== 'text')
      return res.status(400).json({ success: false, message: 'Only text messages can be edited.' })

    // Check if within 15 minutes
    const messageTime = message.sentAt || message.createdAt
    const timeDiff = Date.now() - messageTime.getTime()
    if (timeDiff > EDIT_TIME_LIMIT_MS)
      return res.status(400).json({ success: false, message: 'Message can only be edited within 15 minutes of sending.' })

    if (!encryptedMessage)
      return res.status(400).json({ success: false, message: 'Encrypted message is required.' })

    // Update the message with new encrypted content and edit timestamp
    message.encryptedMessage = encryptedMessage
    message.iv = iv
    message.encryptedKey = encryptedKey || message.encryptedKey
    message.editedAt = new Date()
    await message.save()

    await message.populate('sender',   'username avatarColor avatar')
    await message.populate('receiver', 'username avatarColor avatar')

    const messageObj = message.toObject()

    // Emit socket event for the edit to both sender and receiver
    try {
      const io = getIO()
      if (io) {
        const payload = {
          messageId: message._id,
          senderId: message.sender._id || message.sender,
          receiverId: message.receiver._id || message.receiver,
          encryptedMessage: message.encryptedMessage,
          iv: message.iv,
          encryptedKey: message.encryptedKey,
          editedAt: message.editedAt,
        }
        io.to(message.sender._id?.toString() || message.sender.toString()).emit('messageEdited', payload)
        io.to(message.receiver._id?.toString() || message.receiver.toString()).emit('messageEdited', payload)
      }
    } catch (emitErr) {
      console.error('Failed to emit edit event:', emitErr.message)
    }

    res.status(200).json({ success: true, message: messageObj })
  } catch (error) {
    next(error)
  }
}

// ── PATCH /api/messages/:messageId/pin ───────────────────────
const togglePinMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params
    const myId = req.user._id

    const message = await Message.findById(messageId)
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' })
    if (includesUserId(message.deletedFor, myId)) {
      return res.status(404).json({ success: false, message: 'Message not found.' })
    }

    const pinned = includesUserId(message.pinnedBy, myId)
    message.pinnedBy = pinned
      ? message.pinnedBy.filter((id) => toIdString(id) !== toIdString(myId))
      : [...message.pinnedBy, myId]
    await message.save()

    const payload = {
      messageId: message._id,
      pinned: !pinned,
      pinnedBy: message.pinnedBy,
      actorId: myId,
    }

    try {
      const io = getIO()
      if (io) io.to(myId.toString()).emit('messagePinned', payload)
    } catch (emitErr) {
      console.error('Failed to emit pin event:', emitErr.message)
    }

    res.status(200).json({ success: true, message: message.toObject(), pinned: !pinned })
  } catch (error) {
    next(error)
  }
}

// ── PATCH /api/messages/:messageId/star ───────────────────────
const toggleStarMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params
    const myId = req.user._id

    const message = await Message.findById(messageId)
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' })
    if (includesUserId(message.deletedFor, myId)) {
      return res.status(404).json({ success: false, message: 'Message not found.' })
    }

    const starred = includesUserId(message.starredBy, myId)
    message.starredBy = starred
      ? message.starredBy.filter((id) => toIdString(id) !== toIdString(myId))
      : [...message.starredBy, myId]
    await message.save()

    const payload = {
      messageId: message._id,
      starred: !starred,
      starredBy: message.starredBy,
      actorId: myId,
    }

    try {
      const io = getIO()
      if (io) io.to(myId.toString()).emit('messageStarred', payload)
    } catch (emitErr) {
      console.error('Failed to emit star event:', emitErr.message)
    }

    res.status(200).json({ success: true, message: message.toObject(), starred: !starred })
  } catch (error) {
    next(error)
  }
}

// ── DELETE /api/messages/:messageId ───────────────────────────
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params
    const { scope = 'me' } = req.body || {}
    const myId = req.user._id
    const DELETE_FOR_EVERYONE_LIMIT_MS = 15 * 60 * 1000

    const message = await Message.findById(messageId)
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' })

    const visibleToMe = !includesUserId(message.deletedFor, myId)
    if (!visibleToMe) return res.status(404).json({ success: false, message: 'Message not found.' })

    const canDeleteForEveryone = message.sender.toString() === myId.toString() && (() => {
      const messageTime = message.sentAt || message.createdAt
      return Date.now() - messageTime.getTime() <= DELETE_FOR_EVERYONE_LIMIT_MS
    })()

    const deleteForEveryone = scope === 'everyone' && canDeleteForEveryone
    if (scope === 'everyone' && !deleteForEveryone) {
      return res.status(400).json({ success: false, message: 'Message can only be deleted for everyone within 15 minutes by the sender.' })
    }

    const targetIds = deleteForEveryone
      ? Array.from(new Set([toIdString(message.sender), toIdString(message.receiver)]))
      : [toIdString(myId)]

    message.deletedFor = Array.from(new Set([
      ...(message.deletedFor || []).map(toIdString),
      ...targetIds,
    ]))

    await message.save()

    const payload = {
      messageId: message._id,
      senderId: message.sender,
      receiverId: message.receiver,
      deletedFor: message.deletedFor,
      deletedForEveryone: deleteForEveryone,
      actorId: myId,
    }

    try {
      const io = getIO()
      if (io) {
        if (deleteForEveryone) {
          io.to(toIdString(message.sender)).emit('messageDeleted', payload)
          io.to(toIdString(message.receiver)).emit('messageDeleted', payload)
        } else {
          io.to(toIdString(myId)).emit('messageDeleted', payload)
        }
      }
    } catch (emitErr) {
      console.error('Failed to emit delete event:', emitErr.message)
    }

    res.status(200).json({
      success: true,
      message: deleteForEveryone ? 'Message deleted for everyone.' : 'Message deleted for you.',
      data: { messageId: message._id, deletedForEveryone: deleteForEveryone },
    })
  } catch (error) {
    next(error)
  }
}

// ── POST /api/messages/:messageId/forward ─────────────────────
// Forward a message to another user via REST API
const forwardMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params
    const { to, encryptedMessage, iv, encryptedKey } = req.body
    const senderId = req.user._id

    if (!to || !encryptedMessage) {
      return res.status(400).json({ success: false, message: 'Recipient and encrypted message are required.' })
    }

    if (to === senderId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot forward a message to yourself.' })
    }

    const originalMessage = await Message.findById(messageId)
    if (!originalMessage) {
      return res.status(404).json({ success: false, message: 'Original message not found.' })
    }

    const receiver = await User.findById(to).select('username isOnline pushTokens')
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Recipient not found.' })
    }

    // Create forwarded message
    const forwardedMessage = await Message.create({
      sender: senderId,
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
    })

    await forwardedMessage.populate('sender', 'username avatarColor avatar')
    await forwardedMessage.populate('receiver', 'username avatarColor avatar')
    await forwardedMessage.populate('forwardedFrom')

    // Emit socket event if available
    try {
      const io = getIO()
      if (io) {
        const messageObj = forwardedMessage.toObject()
        io.to(to).emit('newMessage', messageObj)
        io.to(to).emit('messageStatusUpdated', {
          messageId: forwardedMessage._id,
          senderId: forwardedMessage.sender._id,
          receiverId: forwardedMessage.receiver._id,
          deliveredAt: new Date(),
          readAt: null,
          read: false,
        })
      }
    } catch (emitErr) {
      console.error('Failed to emit forward event:', emitErr.message)
    }

    // Send push notification
    const messageObj = forwardedMessage.toObject()
    try {
      await sendPushNotification({ receiver, sender: forwardedMessage.sender, message: messageObj })
    } catch (notifErr) {
      console.error('Push notification error:', notifErr.message)
    }

    res.status(201).json({ success: true, message: forwardedMessage })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  getUnreadCounts,
  getScheduledMessages,
  getStarredMessages,
  cancelScheduledMessage,
  editMessage,
  forwardMessage,
  togglePinMessage,
  toggleStarMessage,
  deleteMessage,
}

