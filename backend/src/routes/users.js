const express = require('express')
const { body } = require('express-validator')
const { searchUsers, getAllUsers, getUserById, registerPushToken, setPublicKey, getPublicKey, togglePinConversation, toggleStarConversation, markConversationRead } = require('../controllers/userController')
const { protect } = require('../middlewares/auth')

const router = express.Router()

// All routes require auth
router.use(protect)

// GET /api/users/search?q=  ← must be before /:id
router.get('/search', searchUsers)

// POST /api/users/public-key  — save my public key
router.post('/public-key', [body('publicKey').notEmpty().withMessage('Public key required.')], setPublicKey)

// GET /api/users/public-key/:userId  — fetch other's public key (must be before /:id)
router.get('/public-key/:userId', getPublicKey)

// PATCH /api/users/pin-conversation/:userId  — pin/unpin a conversation
router.patch('/pin-conversation/:userId', togglePinConversation)

// PATCH /api/users/star-conversation/:userId  — star/unstar a conversation (favorites)
router.patch('/star-conversation/:userId', toggleStarConversation)

// PATCH /api/users/mark-conversation-read/:userId  — mark conversation as read
router.patch('/mark-conversation-read/:userId', markConversationRead)

// GET /api/users
router.get('/', getAllUsers)

// GET /api/users/:id
router.get('/:id', getUserById)

// POST /api/users/push-token
router.post(
  '/push-token',
  [body('token').trim().notEmpty().withMessage('Push token is required.')],
  registerPushToken
)

module.exports = router
