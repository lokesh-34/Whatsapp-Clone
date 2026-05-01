const express = require('express')
const { body } = require('express-validator')
const { getConversations, getMessages, sendMessage, getUnreadCounts, getScheduledMessages, getStarredMessages, cancelScheduledMessage, editMessage, forwardMessage, togglePinMessage, toggleStarMessage, deleteMessage } = require('../controllers/messageController')
const { protect } = require('../middlewares/auth')

const router = express.Router()
router.use(protect)

// GET /api/messages/conversations  — must be before /:userId
router.get('/conversations', getConversations)

// GET /api/messages/unread
router.get('/unread', getUnreadCounts)

// GET /api/messages/starred
router.get('/starred', getStarredMessages)

// GET /api/messages/:userId/scheduled  (list scheduled messages I have queued for this user)
router.get('/:userId/scheduled', getScheduledMessages)

// DELETE /api/messages/scheduled/:messageId  (cancel a scheduled message)
router.delete('/scheduled/:messageId', cancelScheduledMessage)

// PUT /api/messages/:messageId/edit  (edit a text message within 15 minutes)
router.put('/:messageId/edit', editMessage)

// PATCH /api/messages/:messageId/pin  (toggle pin for current user)
router.patch('/:messageId/pin', togglePinMessage)

// PATCH /api/messages/:messageId/star  (toggle star for current user)
router.patch('/:messageId/star', toggleStarMessage)

// DELETE /api/messages/:messageId  (delete for me or for everyone)
router.delete('/:messageId', deleteMessage)

// POST /api/messages/:messageId/forward  (forward a message to another user)
router.post('/:messageId/forward', forwardMessage)

// GET /api/messages/:userId
router.get('/:userId', getMessages)

// POST /api/messages/:userId
router.post(
  '/:userId',
  [],
  sendMessage
)

module.exports = router
