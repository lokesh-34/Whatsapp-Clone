import { motion } from 'framer-motion'
import { Avatar, AvatarFallback } from '../ui/avatar'
import SpotlightCard from '../bits/SpotlightCard'
import ShinyText from '../bits/ShinyText'
import UserItem from './UserItem'
import GradientText from '../bits/GradientText'

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

export default function Sidebar({
  currentUser, users, selectedUser, onSelectUser,
  onLogout, isOnline, unreadMap, searchQuery, onSearch,
}) {
  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <Avatar style={{ background: currentUser?.avatarColor, width: 36, height: 36 }}>
            <AvatarFallback style={{ background: currentUser?.avatarColor, color: '#fff', fontSize: 14, fontWeight: 700 }}>
              {currentUser?.username?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="sidebar-username">
            <ShinyText
              text={currentUser?.username || ''}
              color="#E9EDEF"
              shineColor="#ffffff"
              speed={6}
            />
          </span>
        </div>
        <motion.button
          id="logout-btn" className="icon-btn" onClick={onLogout} title="Logout"
          whileHover={{ scale: 1.15, rotate: 12 }} whileTap={{ scale: 0.88 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </motion.button>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <div className="search-wrap">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="user-search" type="text" placeholder="Search or start new chat"
            value={searchQuery} onChange={(e) => onSearch(e.target.value)} className="search-input"
          />
        </div>
      </div>

      {/* Section label */}
      {users.length > 0 && (
        <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <GradientText colors={['#8696A0', '#00A884', '#8696A0']} animationSpeed={12}>
            Contacts
          </GradientText>
        </div>
      )}

      {/* User List */}
      <div className="sidebar-list">
        {users.length === 0 ? (
          <div className="sidebar-empty"><p>No users found</p></div>
        ) : (
          <motion.div variants={listVariants} initial="hidden" animate="visible">
            {users.map((u) => (
              <UserItem
                key={u._id} user={u}
                isSelected={selectedUser?._id === u._id}
                isOnline={isOnline(u._id)}
                unreadCount={unreadMap[u._id] || 0}
                onClick={() => onSelectUser(u)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </aside>
  )
}
