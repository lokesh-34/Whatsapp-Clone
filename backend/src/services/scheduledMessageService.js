const Message = require('../models/Message')
const { sendPushNotification } = require('./pushNotifications')

const isRoomOnline = (io, userId) => {
  const room = io.sockets.adapter.rooms.get(userId.toString())
  return Boolean(room && room.size > 0)
}

const emitMessageStatus = (io, message) => {
  const payload = {
    messageId: message._id,
    senderId: message.sender?._id || message.sender,
    receiverId: message.receiver?._id || message.receiver,
    deliveredAt: message.deliveredAt || null,
    readAt: message.readAt || null,
    read: !!message.read,
    scheduledStatus: message.scheduledStatus,
    sentAt: message.sentAt || null,
    scheduledFor: message.scheduledFor || null,
  }

  io.to(payload.senderId.toString()).emit('messageStatusUpdated', payload)
}

const dispatchDueScheduledMessages = async (io) => {
  const now = new Date()
  const dueMessages = await Message.find({
    scheduledStatus: 'scheduled',
    scheduledFor: { $lte: now },
  })
    .sort({ scheduledFor: 1 })
    .limit(50)

  for (const queuedMessage of dueMessages) {
    const message = await Message.findOneAndUpdate(
      {
        _id: queuedMessage._id,
        scheduledStatus: 'scheduled',
        scheduledFor: { $lte: now },
      },
      {
        $set: {
          scheduledStatus: 'sent',
          sentAt: new Date(),
        },
      },
      { new: true }
    )

    if (!message) continue

    await message.populate('sender', 'username avatarColor avatar')
    await message.populate('receiver', 'username avatarColor avatar')

    const receiverOnline = isRoomOnline(io, message.receiver)
    if (receiverOnline) {
      message.deliveredAt = new Date()
      await message.save()
    }

    const messageObj = message.toObject()

    await sendPushNotification({ receiver: message.receiver, sender: message.sender, message: messageObj })

    io.to(message.receiver.toString()).emit('newMessage', messageObj)
    emitMessageStatus(io, messageObj)
  }
}

const startScheduledMessageWorker = (io) => {
  if (io.__scheduledMessageWorkerStarted) return

  io.__scheduledMessageWorkerStarted = true
  const run = () => {
    dispatchDueScheduledMessages(io).catch((error) => {
      console.error('Scheduled message worker error:', error.message)
    })
  }

  run()
  io.__scheduledMessageWorkerTimer = setInterval(run, 5000)
}

module.exports = {
  startScheduledMessageWorker,
  dispatchDueScheduledMessages,
}