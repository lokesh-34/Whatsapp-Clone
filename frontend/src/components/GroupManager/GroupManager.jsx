import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Plus, Search, Shield, UserMinus, UserPlus, Users, PencilLine, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '../ui/avatar'
import {
  addGroupMembers,
  createGroup as createGroupApi,
  getGroups,
  getUsers,
  removeGroupMembers,
  renameGroup as renameGroupApi,
} from '../../api'

const getId = (value) => value?._id?.toString?.() || value?.toString?.() || ''

const isSameId = (left, right) => getId(left) === getId(right)

const initials = (name = '') => (name.trim()[0] || '?').toUpperCase()

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('Failed to read selected file'))
  reader.readAsDataURL(file)
})

function UserRow({ user, actionLabel, actionIcon: ActionIcon, onAction, disabled = false, badge, compact = false }) {
  return (
    <button type="button" className={`group-user-row ${compact ? 'group-user-row--compact' : ''}`} onClick={onAction} disabled={disabled}>
      <Avatar style={{ background: user.avatarColor, width: 42, height: 42, flexShrink: 0 }}>
        <AvatarFallback style={{ background: user.avatarColor, color: '#fff', fontWeight: 700, fontSize: 15 }}>
          {user.avatar
            ? <img src={user.avatar} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : initials(user.username)
          }
        </AvatarFallback>
      </Avatar>
      <div className="group-user-row-info">
        <div className="group-user-row-topline">
          <span className="group-user-name">{user.username}</span>
          {badge}
        </div>
        <span className="group-user-email">{user.email}</span>
      </div>
      <span className="group-user-action">
        <ActionIcon size={14} />
        {actionLabel}
      </span>
    </button>
  )
}

function DialogShell({ title, description, onClose, children, actionText, onAction, actionDisabled, actionIcon: ActionIcon }) {
  return (
    <motion.div
      className="modal-overlay group-dialog-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.div
        className="modal-card group-dialog-card"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.18 }}
      >
        <div className="group-dialog-header">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" className="group-dialog-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="group-dialog-body">{children}</div>
        <div className="group-dialog-actions">
          <button type="button" className="group-cancel-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="group-save-btn" onClick={onAction} disabled={actionDisabled}>
            {ActionIcon && <ActionIcon size={15} />}
            {actionText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function GroupManager({ open, onClose, currentUser }) {
  const [groups, setGroups] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [groupSearch, setGroupSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [createSearch, setCreateSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createAvatar, setCreateAvatar] = useState(null)
  const [createMembers, setCreateMembers] = useState([])
  const [renameName, setRenameName] = useState('')
  const [renameAvatar, setRenameAvatar] = useState(null)
  const currentUserId = getId(currentUser)

  const loadGroups = async () => {
    setLoading(true)
    setError('')
    try {
      const [{ data: groupsData }, { data: usersData }] = await Promise.all([getGroups(), getUsers()])
      const nextGroups = groupsData.groups || []
      setGroups(nextGroups)
      setUsers(usersData.users || [])
      setSelectedGroupId((current) => current || nextGroups[0]?._id || '')
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load groups.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    loadGroups()
  }, [open])

  const selectedGroup = useMemo(
    () => groups.find((group) => isSameId(group._id, selectedGroupId)) || groups[0] || null,
    [groups, selectedGroupId]
  )

  useEffect(() => {
    if (selectedGroup && !selectedGroupId) {
      setSelectedGroupId(selectedGroup._id)
    }
  }, [selectedGroup, selectedGroupId])

  useEffect(() => {
    if (selectedGroup) {
      setRenameName(selectedGroup.name || '')
      setRenameAvatar(selectedGroup.avatar || null)
    }
  }, [selectedGroup?._id])

  const canManageGroup = useMemo(() => {
    if (!selectedGroup) return false
    const createdById = getId(selectedGroup.createdBy)
    const adminIds = (selectedGroup.admins || []).map(getId)
    return createdById === currentUserId || adminIds.includes(currentUserId)
  }, [selectedGroup, currentUserId])

  const selectedMemberIds = useMemo(() => new Set(createMembers), [createMembers])

  const createCandidates = useMemo(() => {
    const term = createSearch.toLowerCase().trim()
    return users
      .filter((user) => !selectedMemberIds.has(user._id))
      .filter((user) => {
        if (!term) return true
        return (user.username || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term)
      })
      .sort((left, right) => (left.username || '').localeCompare(right.username || ''))
  }, [users, createSearch, selectedMemberIds])

  const addCandidates = useMemo(() => {
    if (!selectedGroup) return []
    const memberIds = new Set((selectedGroup.members || []).map(getId))
    const term = memberSearch.toLowerCase().trim()
    return users
      .filter((user) => !memberIds.has(user._id))
      .filter((user) => {
        if (!term) return true
        return (user.username || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term)
      })
      .sort((left, right) => (left.username || '').localeCompare(right.username || ''))
  }, [users, selectedGroup, memberSearch])

  const openCreateDialog = () => {
    setCreateName('')
    setCreateDescription('')
    setCreateAvatar(null)
    setCreateMembers([])
    setCreateSearch('')
    setCreateOpen(true)
  }

  const handleAvatarSelection = async (event, target) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const maxBytes = 4 * 1024 * 1024
    if (file.size > maxBytes) {
      setError('Image is too large. Maximum allowed size is 4MB.')
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      if (target === 'create') setCreateAvatar(dataUrl)
      if (target === 'rename') setRenameAvatar(dataUrl)
    } catch (err) {
      setError(err.message || 'Failed to process avatar image.')
    }
  }

  const toggleCreateMember = (userId) => {
    setCreateMembers((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]))
  }

  const handleCreateGroup = async () => {
    if (!createName.trim()) return
    setSaving(true)
    setError('')
    try {
      const { data } = await createGroupApi({
        name: createName.trim(),
        description: createDescription.trim(),
        avatar: createAvatar,
        memberIds: createMembers,
      })
      await loadGroups()
      setSelectedGroupId(data.group?._id || '')
      setCreateOpen(false)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create group.')
    } finally {
      setSaving(false)
    }
  }

  const handleRenameGroup = async () => {
    if (!selectedGroup || !renameName.trim()) return
    setSaving(true)
    setError('')
    try {
      await renameGroupApi(selectedGroup._id, { name: renameName.trim(), avatar: renameAvatar })
      await loadGroups()
      setRenameOpen(false)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to rename group.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMember = async (userId) => {
    if (!selectedGroup || !userId) return
    setSaving(true)
    setError('')
    try {
      await addGroupMembers(selectedGroup._id, { memberIds: [userId] })
      await loadGroups()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to add member.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMember = async (userId) => {
    if (!selectedGroup || !userId) return
    setSaving(true)
    setError('')
    try {
      await removeGroupMembers(selectedGroup._id, { memberIds: [userId] })
      await loadGroups()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to remove member.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="groups-screen">
      <div className="groups-screen-header">
        <button type="button" className="groups-back-btn" onClick={onClose} title="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="groups-screen-title">
          <h2>Groups</h2>
          <p>Create groups, add people, rename, and manage members.</p>
        </div>
        <button type="button" className="groups-create-btn" onClick={openCreateDialog}>
          <Plus size={16} /> New group
        </button>
      </div>

      <div className="groups-screen-body">
        <aside className="groups-list-pane">
          <div className="groups-search">
            <Search size={16} className="groups-search-icon" />
            <input
              type="text"
              placeholder="Search groups..."
              value={groupSearch}
              onChange={(event) => setGroupSearch(event.target.value)}
            />
          </div>

          <div className="groups-list">
            {loading && <div className="groups-empty">Loading groups...</div>}
            {!loading && groups.length === 0 && <div className="groups-empty">No groups yet. Create your first one.</div>}
            {!loading && groups.filter((group) => (group.name || '').toLowerCase().includes(groupSearch.toLowerCase().trim())).map((group) => (
              <button
                key={group._id}
                type="button"
                className={`groups-list-item ${isSameId(group._id, selectedGroupId) ? 'active' : ''}`}
                onClick={() => setSelectedGroupId(group._id)}
              >
                <Avatar style={{ width: 42, height: 42, background: '#22313a' }}>
                  <AvatarFallback style={{ background: '#22313a', color: '#fff', fontWeight: 700 }}>
                    {initials(group.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="groups-list-item-info">
                  <div className="groups-list-item-topline">
                    <span className="groups-list-item-name">{group.name}</span>
                    {isSameId(group.createdBy, currentUserId) && <span className="group-pill">Owner</span>}
                  </div>
                  <span className="groups-list-item-meta">{group.members?.length || 0} members</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="groups-detail-pane">
          {!selectedGroup ? (
            <div className="groups-empty groups-empty--detail">
              <Users size={34} />
              <p>Select a group to manage members and settings.</p>
            </div>
          ) : (
            <>
              <div className="groups-detail-header">
                <div className="groups-detail-titlewrap">
                  <Avatar style={{ width: 54, height: 54, background: '#22313a' }}>
                    <AvatarFallback style={{ background: '#22313a', color: '#fff', fontSize: 18, fontWeight: 700 }}>
                      {initials(selectedGroup.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3>{selectedGroup.name}</h3>
                    <p>{selectedGroup.description || 'No description added.'}</p>
                    <div className="groups-detail-meta">
                      <span className="group-pill">{selectedGroup.members?.length || 0} members</span>
                      {canManageGroup && <span className="group-pill group-pill--admin"><Shield size={12} /> Admin</span>}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="groups-rename-btn"
                  onClick={() => setRenameOpen(true)}
                  disabled={!canManageGroup}
                  title={canManageGroup ? 'Rename group' : 'Only admins can rename'}
                >
                  <PencilLine size={16} /> Rename
                </button>
              </div>

              <div className="groups-section">
                <div className="groups-section-header">
                  <h4>Members</h4>
                  <span>{selectedGroup.members?.length || 0}</span>
                </div>
                <div className="groups-member-list">
                  {(selectedGroup.members || []).map((member) => {
                    const memberId = getId(member)
                    const isCreator = isSameId(member, selectedGroup.createdBy)
                    const isCurrentUser = memberId === currentUserId
                    const canRemove = canManageGroup && !isCreator && !saving
                    return (
                      <div key={memberId} className="groups-member-row">
                        <Avatar style={{ width: 40, height: 40, background: member.avatarColor }}>
                          <AvatarFallback style={{ background: member.avatarColor, color: '#fff', fontWeight: 700 }}>
                            {member.avatar
                              ? <img src={member.avatar} alt={member.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                              : initials(member.username)
                            }
                          </AvatarFallback>
                        </Avatar>
                        <div className="groups-member-info">
                          <div className="groups-member-topline">
                            <span>{member.username}</span>
                            {isCreator && <span className="group-pill">Creator</span>}
                            {isCurrentUser && <span className="group-pill">You</span>}
                          </div>
                          <span>{member.email}</span>
                        </div>
                        <button
                          type="button"
                          className="groups-member-action groups-member-action--remove"
                          onClick={() => handleRemoveMember(memberId)}
                          disabled={!canRemove}
                          title={canRemove ? 'Remove member' : 'Only admins can remove members'}
                        >
                          <UserMinus size={14} /> Remove
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="groups-section">
                <div className="groups-section-header">
                  <h4>Add members</h4>
                  <span>{addCandidates.length}</span>
                </div>
                <div className="groups-section-search">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search people to add..."
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                  />
                </div>
                <div className="groups-add-list">
                  {addCandidates.length === 0 && <div className="groups-empty groups-empty--inline">No more users to add.</div>}
                  {addCandidates.map((user) => (
                    <UserRow
                      key={user._id}
                      user={user}
                      actionLabel="Add"
                      actionIcon={UserPlus}
                      onAction={() => handleAddMember(user._id)}
                      disabled={!canManageGroup || saving}
                      compact
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <AnimatePresence>
        {createOpen && (
          <DialogShell
            title="Create group"
            description="Choose a group name and optionally add members right away."
            onClose={() => setCreateOpen(false)}
            actionText="Create group"
            onAction={handleCreateGroup}
            actionDisabled={!createName.trim() || saving}
            actionIcon={Plus}
          >
            <div className="group-form-grid">
              <label className="group-field">
                <span>Group name</span>
                <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Weekend plans" />
              </label>
              <label className="group-field">
                <span>Description</span>
                <textarea value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} placeholder="Optional description" rows={3} />
              </label>
              <label className="group-field">
                <span>Group image</span>
                <div className="group-avatar-upload-row">
                  <Avatar style={{ width: 52, height: 52, background: '#22313a' }}>
                    <AvatarFallback style={{ background: '#22313a', color: '#fff', fontWeight: 700 }}>
                      {createAvatar
                        ? <img src={createAvatar} alt="Group avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : initials(createName || 'G')}
                    </AvatarFallback>
                  </Avatar>
                  <input type="file" accept="image/*" onChange={(event) => handleAvatarSelection(event, 'create')} />
                </div>
              </label>
              <div className="groups-section-search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search people to add..."
                  value={createSearch}
                  onChange={(event) => setCreateSearch(event.target.value)}
                />
              </div>
              <div className="groups-add-list groups-add-list--create">
                {createCandidates.length === 0 && <div className="groups-empty groups-empty--inline">No users found.</div>}
                {createCandidates.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    className={`groups-create-select ${selectedMemberIds.has(user._id) ? 'selected' : ''}`}
                    onClick={() => toggleCreateMember(user._id)}
                  >
                    <Avatar style={{ width: 40, height: 40, background: user.avatarColor }}>
                      <AvatarFallback style={{ background: user.avatarColor, color: '#fff', fontWeight: 700 }}>
                        {user.avatar
                          ? <img src={user.avatar} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          : initials(user.username)
                        }
                      </AvatarFallback>
                    </Avatar>
                    <div className="groups-create-select-info">
                      <span>{user.username}</span>
                      <span>{user.email}</span>
                    </div>
                    <span className="group-select-indicator">
                      {selectedMemberIds.has(user._id) ? 'Added' : 'Add'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </DialogShell>
        )}

        {renameOpen && selectedGroup && (
          <DialogShell
            title="Rename group"
            description="Update the group name for everyone in the chat."
            onClose={() => setRenameOpen(false)}
            actionText="Save name"
            onAction={handleRenameGroup}
            actionDisabled={!renameName.trim() || saving}
            actionIcon={PencilLine}
          >
            <label className="group-field">
              <span>Group name</span>
              <input value={renameName} onChange={(event) => setRenameName(event.target.value)} placeholder="New group name" />
            </label>
            <label className="group-field">
              <span>Group image</span>
              <div className="group-avatar-upload-row">
                <Avatar style={{ width: 52, height: 52, background: '#22313a' }}>
                  <AvatarFallback style={{ background: '#22313a', color: '#fff', fontWeight: 700 }}>
                    {renameAvatar
                      ? <img src={renameAvatar} alt="Group avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      : initials(renameName || selectedGroup.name || 'G')}
                  </AvatarFallback>
                </Avatar>
                <input type="file" accept="image/*" onChange={(event) => handleAvatarSelection(event, 'rename')} />
              </div>
            </label>
          </DialogShell>
        )}
      </AnimatePresence>

      {error && <div className="groups-error-toast">{error}</div>}
    </div>
  )
}
