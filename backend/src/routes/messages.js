const express = require('express');
const { body } = require('express-validator');
const {
  getMessages,
  sendMessage,
  getUnreadCounts,
} = require('../controllers/messageController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// All message routes are protected
router.use(protect);

// GET /api/messages/unread  — must be before /:userId to avoid conflict
router.get('/unread', getUnreadCounts);

// GET /api/messages/:userId  — fetch conversation
router.get('/:userId', getMessages);

// POST /api/messages/:userId  — send a message
router.post(
  '/:userId',
  [
    body('content')
      .trim()
      .notEmpty().withMessage('Message content cannot be empty.')
      .isLength({ max: 2000 }).withMessage('Message cannot exceed 2000 characters.'),
  ],
  sendMessage
);

module.exports = router;
