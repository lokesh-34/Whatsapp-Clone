const mongoose = require('mongoose')

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [1, 'Group name must be at least 1 character'],
      maxlength: [80, 'Group name must be at most 80 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [200, 'Group description must be at most 200 characters'],
    },
    avatar: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Group creator is required'],
    },
    members: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    admins: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

groupSchema.index({ members: 1 })
groupSchema.index({ createdBy: 1 })

groupSchema.pre('save', function (next) {
  const createdById = this.createdBy?.toString?.() || String(this.createdBy)
  const memberIds = this.members.map((member) => member?.toString?.() || String(member))
  const adminIds = this.admins.map((admin) => admin?.toString?.() || String(admin))

  if (!memberIds.includes(createdById)) {
    this.members.push(this.createdBy)
  }
  if (!adminIds.includes(createdById)) {
    this.admins.push(this.createdBy)
  }
  next()
})

const Group = mongoose.model('Group', groupSchema)
module.exports = Group
