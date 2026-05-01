const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver is required'],
    },
    // Encrypted content (server never stores plaintext)
    encryptedMessage: {
      type: String,
      required: [true, 'Encrypted message is required'],
    },
    // AES-GCM IV used for message decryption
    iv: {
      type: String,
      required: true,
    },
    // Encrypted AES key for the receiver (RSA-OAEP wrapped)
    encryptedKey: {
      type: String,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    scheduledStatus: {
      type: String,
      enum: ['sent', 'scheduled', 'cancelled'],
      default: 'sent',
    },
    sentAt: {
      type: Date,
      default: null,
    },
    messageType: {
      type: String,
      enum: ['text', 'voice', 'emoji', 'photo', 'camera', 'video', 'document', 'location'],
      default: 'text',
    },
    voiceDuration: {
      type: Number,
      default: null,
    },
    attachmentMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    pinnedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    starredBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    deletedFor: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    editedContent: {
      type: String,
      default: null,
    },
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    isForwarded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

// Indexes for fast conversation and unread queries
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 })
messageSchema.index({ receiver: 1, read: 1 })
messageSchema.index({ scheduledStatus: 1, scheduledFor: 1 })

const Message = mongoose.model('Message', messageSchema)
module.exports = Message
