import { motion } from 'framer-motion'
import { Avatar, AvatarFallback } from '../ui/avatar'

const itemVariants = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}

export default function UserItem({ user, isSelected, isOnline, unreadCount, onClick }) {
  return (
    <motion.button
      variants={itemVariants}
      whileHover={{ x: 3, backgroundColor: 'rgba(42,57,66,0.8)' }}
      className={`user-item ${isSelected ? 'user-item--active' : ''}`}
      onClick={onClick}
      id={`user-${user._id}`}
      style={{ transition: 'none' }}
    >
      <div className="user-item-avatar-wrap">
        <Avatar style={{ background: user.avatarColor, width: 44, height: 44 }}>
          <AvatarFallback style={{ background: user.avatarColor, color: '#fff', fontSize: 18, fontWeight: 700 }}>
            {user.username[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className={`online-dot ${isOnline ? 'online-dot--on' : ''}`} />
      </div>

      <div className="user-item-info">
        <span className="user-item-name">{user.username}</span>
        <span className="user-item-status">
          {user.phone ? (
            <span style={{ color: '#ff9800', fontSize: 11, fontWeight: 600 }}>
              📱 {user.phone}
            </span>
          ) : (
            isOnline ? 'Online' : 'Offline'
          )}
        </span>
      </div>

      {unreadCount > 0 && (
        <motion.span
          className="unread-badge"
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </motion.span>
      )}
    </motion.button>
  )
}
