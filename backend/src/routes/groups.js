const express = require('express')
const { body } = require('express-validator')
const {
  getMyGroups,
  getGroupById,
  createGroup,
  renameGroup,
  addGroupMembers,
  removeGroupMembers,
  removeGroupMember,
  getGroupMessages,
  sendGroupMessage,
  markGroupMessagesSeen,
} = require('../controllers/groupController')
const { protect } = require('../middlewares/auth')

const router = express.Router()
router.use(protect)

// GET /api/groups
router.get('/', getMyGroups)

// POST /api/groups
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Group name is required.').isLength({ min: 1, max: 80 }).withMessage('Group name must be 1-80 characters.'),
  ],
  createGroup
)

// POST /api/groups/:groupId/members
router.post(
  '/:groupId/members',
  [body('memberIds').custom((value) => Array.isArray(value) || typeof value === 'string').withMessage('memberIds must be an array.')],
  addGroupMembers
)

// GET /api/groups/:groupId/messages
router.get('/:groupId/messages', getGroupMessages)

// POST /api/groups/:groupId/messages
router.post('/:groupId/messages', sendGroupMessage)

// POST /api/groups/:groupId/seen
router.post('/:groupId/seen', markGroupMessagesSeen)

// DELETE /api/groups/:groupId/members
router.delete('/:groupId/members', removeGroupMembers)

// DELETE /api/groups/:groupId/members/:memberId
router.delete('/:groupId/members/:memberId', removeGroupMember)

// PATCH /api/groups/:groupId
router.patch(
  '/:groupId',
  [],
  renameGroup
)

// GET /api/groups/:groupId
router.get('/:groupId', getGroupById)

module.exports = router
