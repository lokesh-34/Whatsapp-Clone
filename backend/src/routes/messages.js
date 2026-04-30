const express = require('express')
const { body } = require('express-validator')
const { getConversations, getMessages, sendMessage, getUnreadCounts } = require('../controllers/messageController')
const { protect } = require('../middlewares/auth')

const router = express.Router()
router.use(protect)

// GET /api/messages/conversations  — must be before /:userId
router.get('/conversations', getConversations)

// GET /api/messages/unread
router.get('/unread', getUnreadCounts)

// GET /api/messages/:userId
router.get('/:userId', getMessages)

// POST /api/messages/:userId
router.post(
  '/:userId',
  [],
  sendMessage
)

module.exports = router
