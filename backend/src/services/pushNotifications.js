/**
 * Backend push notification service using Firebase Cloud Messaging (FCM).
 * Sends notifications to users when they receive a new message.
 */
const { getAdmin } = require('../config/firebaseAdmin')

/**
 * Sends a push notification to a user.
 * @param {Object} options
 * @param {Object} options.receiver - The receiver user document (must have pushTokens)
 * @param {Object} options.sender - The sender user document/object
 * @param {Object} options.message - The message object (contains type, content preview)
 */
const sendPushNotification = async ({ receiver, sender, message }) => {
  const admin = getAdmin()
  if (!admin) return { sent: false, reason: 'firebase-not-configured' }

  // Fetch tokens (need to select them explicitly if not present in the object)
  const tokens = receiver.pushTokens || []
  if (!tokens.length) return { sent: false, reason: 'no-tokens' }

  const senderName = sender?.username || 'Someone'
  const body = message.messageType === 'text' 
    ? (message.content || 'Sent a message')
    : `Sent a ${message.messageType}`

  const payload = {
    notification: {
      title: senderName,
      body: body,
    },
    data: {
      type: 'NEW_MESSAGE',
      senderId: (sender?._id || sender?.id || '').toString(),
      senderName: senderName,
      messageId: (message?._id || message?.id || '').toString(),
      click_action: 'FLUTTER_NOTIFICATION_CLICK', // Legacy compatibility
    },
  }

  try {
    // Send to all registered devices for this user
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: payload.notification,
      data: payload.data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'messages',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    })

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const invalidTokens = []
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const errorCode = res.error?.code
          if (errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered') {
            invalidTokens.push(tokens[idx])
          }
        }
      })

      if (invalidTokens.length > 0) {
        const User = require('../models/User')
        await User.findByIdAndUpdate(receiver._id, {
          $pull: { pushTokens: { $in: invalidTokens } }
        })
      }
    }

    return { sent: true, successCount: response.successCount }
  } catch (error) {
    console.error('FCM Send Error:', error.message)
    return { sent: false, error: error.message }
  }
}

module.exports = { sendPushNotification }