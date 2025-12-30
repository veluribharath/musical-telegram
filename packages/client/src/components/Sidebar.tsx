import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore, Conversation, User } from '../stores/chatStore';
import { formatDistanceToNow } from 'date-fns';

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const {
    conversations,
    currentConversation,
    selectConversation,
    searchUsers,
    createConversation,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const name = getConversationName(conv);
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  function getConversationName(conv: Conversation): string {
    if (conv.name) return conv.name;
    const otherMembers = conv.members.filter((m) => m.id !== user?.id);
    return otherMembers.map((m) => m.displayName).join(', ') || 'Unknown';
  }

  function getConversationAvatar(conv: Conversation): string {
    if (conv.isGroup) return conv.name?.[0] || 'G';
    const other = conv.members.find((m) => m.id !== user?.id);
    return other?.displayName?.[0]?.toUpperCase() || '?';
  }

  function getOnlineStatus(conv: Conversation): string {
    if (conv.isGroup) return '';
    const other = conv.members.find((m) => m.id !== user?.id);
    return other?.status || 'offline';
  }

  const handleUserSearch = async (query: string) => {
    setUserSearchQuery(query);
    if (query.trim().length >= 2) {
      const results = await searchUsers(query);
      setUserSearchResults(results);
    } else {
      setUserSearchResults([]);
    }
  };

  const handleSelectUser = (selectedUser: User) => {
    if (showNewGroup) {
      if (selectedUsers.some((u) => u.id === selectedUser.id)) {
        setSelectedUsers(selectedUsers.filter((u) => u.id !== selectedUser.id));
      } else {
        setSelectedUsers([...selectedUsers, selectedUser]);
      }
    } else {
      handleStartChat([selectedUser]);
    }
  };

  const handleStartChat = async (users: User[], forceGroup: boolean = false) => {
    const memberIds = users.map((u) => u.id);
    const isGroup = forceGroup || showNewGroup;
    const name = isGroup ? groupName : undefined;

    const conv = await createConversation(memberIds, name, isGroup);
    if (conv) {
      selectConversation(conv);
    }

    setShowNewChat(false);
    setShowNewGroup(false);
    setUserSearchQuery('');
    setUserSearchResults([]);
    setSelectedUsers([]);
    setGroupName('');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>ChatterBox</h2>
        <div className="user-info">
          <div className="user-avatar">{user?.displayName?.[0]?.toUpperCase()}</div>
          <button className="btn btn-secondary" onClick={logout} style={{ padding: '6px 12px', fontSize: '12px' }}>
            Logout
          </button>
        </div>
      </div>

      <div className="sidebar-actions">
        <button className="btn btn-primary" onClick={() => setShowNewChat(true)}>
          New Chat
        </button>
        <button className="btn btn-secondary" onClick={() => setShowNewGroup(true)}>
          New Group
        </button>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="conversation-list">
        {filteredConversations.map((conv) => (
          <div
            key={conv.id}
            className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
            onClick={() => selectConversation(conv)}
          >
            <div className="conversation-avatar">
              {getConversationAvatar(conv)}
              {!conv.isGroup && (
                <span className={`status-indicator ${getOnlineStatus(conv)}`} />
              )}
            </div>
            <div className="conversation-details">
              <div className="conversation-name">{getConversationName(conv)}</div>
              <div className="conversation-preview">
                {conv.lastMessage?.type === 'image'
                  ? '📷 Image'
                  : conv.lastMessage?.type === 'file'
                  ? `📎 ${conv.lastMessage.fileName}`
                  : conv.lastMessage?.content || 'No messages yet'}
              </div>
            </div>
            {conv.lastMessage && (
              <div className="conversation-time">
                {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false })}
              </div>
            )}
          </div>
        ))}

        {filteredConversations.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {searchQuery ? 'No conversations found' : 'No conversations yet. Start a new chat!'}
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {(showNewChat || showNewGroup) && (
        <div className="modal-overlay" onClick={() => { setShowNewChat(false); setShowNewGroup(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{showNewGroup ? 'Create Group Chat' : 'Start New Chat'}</h3>

            {showNewGroup && (
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                />
              </div>
            )}

            <div className="form-group">
              <label>Search Users</label>
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => handleUserSearch(e.target.value)}
                placeholder="Search by username or name"
                autoFocus
              />
            </div>

            {selectedUsers.length > 0 && (
              <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedUsers.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      background: 'var(--accent)',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {u.displayName}
                    <button
                      onClick={() => handleSelectUser(u)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '16px',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="user-search-results">
              {userSearchResults.map((searchUser) => (
                <div
                  key={searchUser.id}
                  className={`user-search-item ${selectedUsers.some((u) => u.id === searchUser.id) ? 'selected' : ''}`}
                  onClick={() => handleSelectUser(searchUser)}
                >
                  <div className="user-avatar">{searchUser.displayName?.[0]?.toUpperCase()}</div>
                  <div className="user-search-info">
                    <h4>{searchUser.displayName}</h4>
                    <span>@{searchUser.username}</span>
                  </div>
                  <span className={`status-indicator ${searchUser.status}`} style={{ position: 'static' }} />
                </div>
              ))}

              {userSearchQuery.length >= 2 && userSearchResults.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No users found
                </div>
              )}
            </div>

            {showNewGroup && (
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => { setShowNewGroup(false); setSelectedUsers([]); setGroupName(''); }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleStartChat(selectedUsers, true)}
                  disabled={!groupName.trim() || selectedUsers.length === 0}
                >
                  Create Group ({selectedUsers.length + 1} members)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
