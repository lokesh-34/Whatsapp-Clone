const { validationResult } = require('express-validator')
const mongoose = require('mongoose')
const Group = require('../models/Group')
const User = require('../models/User')
const Message = require('../models/Message')

const GROUP_USER_FIELDS = '_id username email avatarColor isOnline lastSeen avatar'

const toIdString = (value) => value?.toString?.() || String(value)
const uniqueIdStrings = (values = []) => [...new Set(values.map(toIdString).filter(Boolean))]
const validObjectIdStrings = (values = []) => uniqueIdStrings(values).filter((value) => mongoose.Types.ObjectId.isValid(value))

const normalizeMemberIds = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch (error) {
      return value.split(',').map((item) => item.trim()).filter(Boolean)
    }
  }
  return []
}

const populateGroup = (query) => query
  .populate('createdBy', GROUP_USER_FIELDS)
  .populate('members', GROUP_USER_FIELDS)
  .populate('admins', GROUP_USER_FIELDS)

const populateGroupMessage = (query) => query
  .populate('sender', GROUP_USER_FIELDS)
  .populate('seenBy.user', GROUP_USER_FIELDS)

const canManageGroup = (group, userId) => {
  const currentUserId = toIdString(userId)
  return toIdString(group.createdBy) === currentUserId || group.admins.some((adminId) => toIdString(adminId) === currentUserId)
}

const isValidGroupId = (groupId) => mongoose.Types.ObjectId.isValid(groupId)

const getMissingUserIds = async (userIds) => {
  if (!userIds.length) return []
  const users = await User.find({ _id: { $in: userIds } }).select('_id')
  const foundIds = new Set(users.map((user) => toIdString(user._id)))
  return userIds.filter((userId) => !foundIds.has(toIdString(userId)))
}

const formatGroupResponse = (group) => group.toObject ? group.toObject() : group

const getLastGroupMessage = async (groupId, userId) => Message.findOne({
  group: groupId,
  deletedFor: { $ne: userId },
})
  .populate('sender', 'username avatarColor avatar')
  .sort({ createdAt: -1 })

// GET /api/groups
const getMyGroups = async (req, res, next) => {
  try {
    const groups = await populateGroup(
      Group.find({ members: req.user._id }).sort({ updatedAt: -1, createdAt: -1 })
    )

    const groupsWithPreview = await Promise.all(groups.map(async (group) => {
      const lastMessage = await getLastGroupMessage(group._id, req.user._id)
      return {
        ...group.toObject(),
        lastMessage: lastMessage ? lastMessage.toObject() : null,
        unreadCount: 0,
      }
    }))

    res.status(200).json({ success: true, count: groups.length, groups: groupsWithPreview })
  } catch (error) {
    next(error)
  }
}

// GET /api/groups/:groupId
const getGroupById = async (req, res, next) => {
  try {
    if (!isValidGroupId(req.params.groupId)) {
      return res.status(404).json({ success: false, message: 'Group not found.' })
    }

    const group = await populateGroup(Group.findById(req.params.groupId))
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' })

    if (!group.members.some((member) => toIdString(member) === toIdString(req.user._id))) {
      return res.status(404).json({ success: false, message: 'Group not found.' })
    }

    res.status(200).json({ success: true, group })
  } catch (error) {
    next(error)
  }
}

// POST /api/groups
const createGroup = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg })
    }

    const { name, description = '', avatar = null } = req.body
    const memberIds = validObjectIdStrings(normalizeMemberIds(req.body.memberIds))
    const creatorId = toIdString(req.user._id)
    const filteredMemberIds = memberIds.filter((memberId) => memberId !== creatorId)

    const invalidMemberIds = uniqueIdStrings(normalizeMemberIds(req.body.memberIds)).filter((memberId) => !mongoose.Types.ObjectId.isValid(memberId))
    if (invalidMemberIds.length) {
      return res.status(400).json({ success: false, message: `Invalid memberIds: ${invalidMemberIds.join(', ')}` })
    }

    const missingUserIds = await getMissingUserIds(filteredMemberIds)
    if (missingUserIds.length) {
      return res.status(404).json({
        success: false,
        message: `Some users were not found: ${missingUserIds.join(', ')}`,
      })
    }

    const group = await Group.create({
      name: name.trim(),
      description: (description || '').trim(),
      avatar,
      createdBy: req.user._id,
      members: [req.user._id, ...filteredMemberIds],
      admins: [req.user._id],
    })

    const populatedGroup = await populateGroup(Group.findById(group._id))
    res.status(201).json({ success: true, group: formatGroupResponse(populatedGroup) })
  } catch (error) {
    next(error)
  }
}

// PATCH /api/groups/:groupId
const renameGroup = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg })
    }

    const { name, avatar } = req.body
    if (!isValidGroupId(req.params.groupId)) {
      return res.status(404).json({ success: false, message: 'Group not found.' })
    }
    const group = await Group.findById(req.params.groupId)
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' })

    if (!group.members.some((member) => toIdString(member) === toIdString(req.user._id))) {
      return res.status(404).json({ success: false, message: 'Group not found.' })
    }

    if (!canManageGroup(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only group admins can edit the group name.' })
    }

    if (typeof name === 'string' && name.trim()) {
      group.name = name.trim()
    }
    if (typeof avatar === 'string' || avatar === null) {
      group.avatar = avatar
    }
    await group.save()

    const populatedGroup = await populateGroup(Group.findById(group._id))
    res.status(200).json({ success: true, group: formatGroupResponse(populatedGroup) })
  } catch (error) {
    next(error)
  }
}

// GET /api/groups/:groupId/messages
const getGroupMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params
    if (!isValidGroupId(groupId)) {
      return res.status(404).json({ success: false, message: 'Group not found.' })
    }

    const group = await Group.findById(groupId).select('_id members')
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' })

    const isMember = group.members.some((member) => toIdString(member) === toIdString(req.user._id))
    if (!isMember) return res.status(404).json({ success: false, message: 'Group not found.' })

    const messages = await Message.find({
      group: groupId,
      deletedFor: { $ne: req.user._id },
    })
      .populate('sender', GROUP_USER_FIELDS)
      .populate('seenBy.user', GROUP_USER_FIELDS)
      .sort({ createdAt: 1 })

    res.status(200).json({ success: true, count: messages.length, messages })
  } catch (error) {
    next(error)
  }
}

// POST /api/groups/:groupId/messages
const sendGroupMessage = async (req, res, next) => {
  try {
    const { groupId } = req.params
    const { content, messageType = 'text', voiceDuration = null, attachmentMeta = null } = req.body

    if (!isValidGroupId(groupId)) {
      return res.status(404).json({ success: false, message: 'Group not found.' })
    }
    if (!content?.toString?.().trim?.()) {
      return res.status(400).json({ success: false, message: 'Message content is required.' })
    }

    const group = await Group.findById(groupId).select('_id members')
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' })

    const isMember = group.members.some((member) => toIdString(member) === toIdString(req.user._id))
    if (!isMember) return res.status(403).json({ success: false, message: 'Only group members can send messages.' })

    const message = await Message.create({
      sender: req.user._id,
      receiver: null,
      group: groupId,
      encryptedMessage: content,
      iv: 'group',
      encryptedKey: null,
      messageType,
      voiceDuration: messageType === 'voice' ? voiceDuration : null,
      attachmentMeta: attachmentMeta || null,
      sentAt: new Date(),
      scheduledStatus: 'sent',
      seenBy: [],
    })

    await populateGroupMessage(message)

    res.status(201).json({ success: true, message })
  } catch (error) {
    next(error)
  }
}

// POST /api/groups/:groupId/seen
const markGroupMessagesSeen = async (req, res, next) => {
  try {
    const { groupId } = req.params
    if (!isValidGroupId(groupId)) {
      return res.status(404).json({ success: false, message: 'Group not found.' })
    }

    const group = await Group.findById(groupId).select('_id members')
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' })

    const isMember = group.members.some((member) => toIdString(member) === toIdString(req.user._id))
    if (!isMember) return res.status(404).json({ success: false, message: 'Group not found.' })

    const unreadMessages = await Message.find({
      group: groupId,
      sender: { $ne: req.user._id },
      deletedFor: { $ne: req.user._id },
      'seenBy.user': { $ne: req.user._id },
    }).select('_id seenBy')

    const seenAt = new Date()
    await Promise.all(unreadMessages.map(async (message) => {
      message.seenBy = [...(message.seenBy || []), { user: req.user._id, seenAt }]
      await message.save()
    }))

    const populatedMessages = unreadMessages.map((message) => message.toObject())

    res.status(200).json({ success: true, count: populatedMessages.length, messages: populatedMessages })
  } catch (error) {
    next(error)
  }
}

// POST /api/groups/:groupId/members
const addGroupMembers = async (req, res, next) => {
  try {
    if (!isValidGroupId(req.params.groupId)) {
      return res.status(404).json({ success: false, message: 'Group not found.' })
    }

    const group = await Group.findById(req.params.groupId)
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' })

    if (!group.members.some((member) => toIdString(member) === toIdString(req.user._id))) {
      return res.status(404).json({ success: false, message: 'Group not found.' })
    }

    if (!canManageGroup(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only group admins can add members.' })
    }

    const rawMemberIds = uniqueIdStrings(normalizeMemberIds(req.body.memberIds))
    const invalidMemberIds = rawMemberIds.filter((memberId) => !mongoose.Types.ObjectId.isValid(memberId))
    if (invalidMemberIds.length) {
      return res.status(400).json({ success: false, message: `Invalid memberIds: ${invalidMemberIds.join(', ')}` })
    }
    const memberIds = validObjectIdStrings(rawMemberIds)
    if (!memberIds.length) {
      return res.status(400).json({ success: false, message: 'memberIds must be a non-empty array.' })
    }

    const missingUserIds = await getMissingUserIds(memberIds)
    if (missingUserIds.length) {
      return res.status(404).json({
        success: false,
        message: `Some users were not found: ${missingUserIds.join(', ')}`,
      })
    }

    const existingMemberIds = new Set(group.members.map((member) => toIdString(member)))
    const newMemberIds = memberIds.filter((memberId) => !existingMemberIds.has(memberId))

    if (newMemberIds.length) {
      group.members = [...group.members, ...newMemberIds]
      await group.save()
    }

    const populatedGroup = await populateGroup(Group.findById(group._id))
    res.status(200).json({ success: true, group: formatGroupResponse(populatedGroup), added: newMemberIds.length })
  } catch (error) {
    next(error)
  }
}

// DELETE /api/groups/:groupId/members
const removeGroupMembers = async (req, res, next) => {
  try {
    if (!isValidGroupId(req.params.groupId)) {
      return res.status(404).json({ success: false, message: 'Group not found.' })
    }

    const group = await Group.findById(req.params.groupId)
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' })

    if (!group.members.some((member) => toIdString(member) === toIdString(req.user._id))) {
      return res.status(404).json({ success: false, message: 'Group not found.' })
    }

    if (!canManageGroup(group, req.user._id) && toIdString(group.createdBy) !== toIdString(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only group admins can remove members.' })
    }

    const rawMemberIds = uniqueIdStrings(normalizeMemberIds(req.body.memberIds))
    const invalidMemberIds = rawMemberIds.filter((memberId) => !mongoose.Types.ObjectId.isValid(memberId))
    if (invalidMemberIds.length) {
      return res.status(400).json({ success: false, message: `Invalid memberIds: ${invalidMemberIds.join(', ')}` })
    }
    const memberIds = validObjectIdStrings(rawMemberIds)
    if (!memberIds.length) {
      return res.status(400).json({ success: false, message: 'memberIds must be a non-empty array.' })
    }

    const creatorId = toIdString(group.createdBy)
    if (memberIds.includes(creatorId)) {
      return res.status(400).json({ success: false, message: 'Group creator cannot be removed.' })
    }

    const currentMemberIds = new Set(group.members.map((member) => toIdString(member)))
    const removableIds = memberIds.filter((memberId) => currentMemberIds.has(memberId))

    if (!removableIds.length) {
      return res.status(400).json({ success: false, message: 'No matching members found in the group.' })
    }

    group.members = group.members.filter((memberId) => !removableIds.includes(toIdString(memberId)))
    group.admins = group.admins.filter((adminId) => !removableIds.includes(toIdString(adminId)))
    await group.save()

    const populatedGroup = await populateGroup(Group.findById(group._id))
    res.status(200).json({ success: true, group: formatGroupResponse(populatedGroup), removed: removableIds.length })
  } catch (error) {
    next(error)
  }
}

// DELETE /api/groups/:groupId/members/:memberId
const removeGroupMember = async (req, res, next) => {
  try {
    req.body.memberIds = [req.params.memberId]
    return removeGroupMembers(req, res, next)
  } catch (error) {
    next(error)
  }
}

module.exports = {
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
}
