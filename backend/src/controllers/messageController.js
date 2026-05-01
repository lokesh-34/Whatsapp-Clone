const { validationResult } = require('express-validator')
const Message = require('../models/Message')
const User    = require('../models/User')
const { sendPushNotification } = require('../services/pushNotifications')
const { getIO } = require('../socket/io')

// ── GET /api/messages/conversations ─────────────────────────
// Returns all users this person has chatted with, sorted by last message
const getConversations = async (req, res, next) => {
  try {
    const myId = req.user._id

    const conversations = await Message.aggregate([
      // All messages involving me
      { $match: { $or: [{ sender: myId }, { receiver: myId }] } },

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
    const { encryptedMessage, iv, encryptedKey, messageType = 'text', voiceDuration = null, scheduledFor = null } = req.body
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
      { $match: { receiver: myId, read: false } },
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

module.exports = { getConversations, getMessages, sendMessage, getUnreadCounts, getScheduledMessages, cancelScheduledMessage }

