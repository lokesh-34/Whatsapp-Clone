const { validationResult } = require('express-validator')
const Message = require('../models/Message')
const User    = require('../models/User')
const { sendPushNotification } = require('../services/pushNotifications')

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
            sender: '$lastMessage.sender',
            read: '$lastMessage.read',
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
    const { encryptedMessage, iv, encryptedKey } = req.body
    const senderId    = req.user._id

    if (userId === senderId.toString())
      return res.status(400).json({ success: false, message: 'You cannot send a message to yourself.' })

    const receiver = await User.findById(userId).select('username isOnline pushTokens')
    if (!receiver) return res.status(404).json({ success: false, message: 'Recipient not found.' })

    if (!encryptedMessage)
      return res.status(400).json({ success: false, message: 'Encrypted message is required.' })

    const message = await Message.create({
      sender:   senderId,
      receiver: userId,
      encryptedMessage,
      iv,
      encryptedKey: encryptedKey || null,
    })

    await message.populate('sender',   'username avatarColor avatar')
    await message.populate('receiver', 'username avatarColor avatar')

    await sendPushNotification({ receiver, sender: message.sender, message })

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

module.exports = { getConversations, getMessages, sendMessage, getUnreadCounts }
