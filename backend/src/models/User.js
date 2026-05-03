const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username must be at most 20 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    phone: {
      type: String,
      required: false,
      unique: true,
      trim: true,
      sparse: true,
      match: [/^\+[1-9]\d{6,14}$/, 'Please enter a valid phone number in E.164 format'],
    },
    password: {
      type: String,
      required: false,   // Optional for Google-login users
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    avatarColor: {
      type: String,
      default: () => {
        const colors = [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
          '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
          '#BB8FCE', '#85C1E9', '#82E0AA', '#F1948A',
        ];
        return colors[Math.floor(Math.random() * colors.length)];
      },
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    pushTokens: {
      type: [String],
      default: [],
      select: false,
    },
    googleId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
      sparse: true,
      index: true,
      // E.164 format: +91XXXXXXXXXX
      match: [/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (e.g. +919876543210)'],
    },
    avatar: {
      type: String,   // Google profile picture URL
      default: null,
    },
    // Public key for E2EE (stored as JWK JSON string)
    publicKey: {
      type: String,
      default: null,
      select: false,
    },
    // Pinned conversations (for sidebar)
    pinnedConversations: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    // Starred conversations (for favorites)
    starredConversations: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    // Muted conversations
    mutedConversations: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Remove sensitive fields when converting to JSON
userSchema.methods.toJSON = function () {
  const userObj = this.toObject();
  delete userObj.password;
  delete userObj.pushTokens;
  return userObj;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
