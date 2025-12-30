import { User } from '../stores/chatStore';

interface UserProfileViewProps {
  user: User;
  onClose: () => void;
}

export function UserProfileView({ user, onClose }: UserProfileViewProps) {
  const getInitials = () => {
    return user.displayName?.[0]?.toUpperCase() || '?';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <h3>User Profile</h3>
          <button className="close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className="avatar-section">
          <div 
            className="profile-avatar-large view-only"
            style={user.avatar ? { backgroundImage: `url(${user.avatar})` } : {}}
          >
            {!user.avatar && getInitials()}
          </div>
        </div>

        <div className="profile-info-section">
          <div className="profile-info-item">
            <label>Display Name</label>
            <div className="profile-info-value">{user.displayName}</div>
          </div>

          <div className="profile-info-item">
            <label>Username</label>
            <div className="profile-info-value">@{user.username}</div>
          </div>

          {user.bio && (
            <div className="profile-info-item">
              <label>Bio</label>
              <div className="profile-info-value bio">{user.bio}</div>
            </div>
          )}

          <div className="profile-info-item">
            <label>Status</label>
            <div className="profile-info-value status">
              <span className={`status-dot ${user.status}`}></span>
              {user.status === 'online' ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>

        <div className="profile-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
