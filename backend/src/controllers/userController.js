const User = require('../models/User')

// @desc    Search users by username or email (excludes self, max 15 results)
// @route   GET /api/users/search?q=query
// @access  Private
const searchUsers = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim()

    if (!q || q.length < 1) {
      return res.status(200).json({ success: true, count: 0, users: [] })
    }

    if (q.length > 60) {
      return res.status(400).json({ success: false, message: 'Search query too long.' })
    }

    // Escape special regex chars to prevent ReDoS
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex   = new RegExp(escaped, 'i')

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { username: regex },
        { email: regex },
      ],
    })
      .select('_id username email avatarColor isOnline lastSeen')
      .limit(15)
      .sort({ username: 1 })

    res.status(200).json({ success: true, count: users.length, users })
  } catch (error) {
    next(error)
  }
}

// @desc    Get a single user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    res.status(200).json({ success: true, user })
  } catch (error) {
    next(error)
  }
}

// @desc    Get all users except self (kept for internal use)
// @route   GET /api/users
// @access  Private
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('-password')
      .sort({ username: 1 })
    res.status(200).json({ success: true, count: users.length, users })
  } catch (error) {
    next(error)
  }
}

// @desc    Save push token
// @route   POST /api/users/push-token
// @access  Private
const registerPushToken = async (req, res, next) => {
  try {
    const { token } = req.body
    if (!token?.trim()) return res.status(400).json({ success: false, message: 'Push token is required.' })
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { pushTokens: token.trim() } }, { new: true })
    res.status(200).json({ success: true, message: 'Push token registered.' })
  } catch (error) {
    next(error)
  }
}



// ── POST /api/users/public-key  (save public key for current user)
const setPublicKey = async (req, res, next) => {
  try {
    const { publicKey } = req.body
    if (!publicKey) return res.status(400).json({ success: false, message: 'Public key is required.' })

    await User.findByIdAndUpdate(req.user._id, { publicKey }, { new: true })
    res.status(200).json({ success: true, message: 'Public key saved.' })
  } catch (error) {
    next(error)
  }
}

// ── GET /api/users/public-key/:userId
const getPublicKey = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select('publicKey username')
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    res.status(200).json({ success: true, publicKey: user.publicKey, username: user.username })
  } catch (error) {
    next(error)
  }
}

module.exports = { searchUsers, getAllUsers, getUserById, registerPushToken, setPublicKey, getPublicKey }
