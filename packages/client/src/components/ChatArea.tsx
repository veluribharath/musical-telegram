import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore, Message, User } from '../stores/chatStore';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { UserProfileView } from './UserProfileView';

export function ChatArea() {
  const { user } = useAuthStore();
  const {
    currentConversation,
    messages,
    typingUsers,
    sendMessage,
    uploadFile,
    sendTyping,
  } = useChatStore();

  const [inputValue, setInputValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const currentMessages = currentConversation ? messages[currentConversation.id] || [] : [];

  const currentTypingUsers = typingUsers.filter(
    (t) => t.conversationId === currentConversation?.id
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);

      // Send typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      sendTyping(true);

      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 2000);
    },
    [sendTyping]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    sendMessage(inputValue.trim());
    setInputValue('');
    sendTyping(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const result = await uploadFile(file);
    setIsUploading(false);

    if (result) {
      sendMessage(
        result.type === 'image' ? 'Shared an image' : `Shared a file: ${result.fileName}`,
        result.type,
        result.fileUrl,
        result.fileName
      );
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getOtherMember = () => {
    if (!currentConversation) return null;
    return currentConversation.members.find((m) => m.id !== user?.id);
  };

  const formatMessageDate = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const shouldShowDateSeparator = (message: Message, index: number): boolean => {
    if (index === 0) return true;
    const prevMessage = currentMessages[index - 1];
    return !isSameDay(new Date(message.createdAt), new Date(prevMessage.createdAt));
  };

  if (!currentConversation) {
    return (
      <div className="chat-area">
        <div className="no-chat-selected">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
          <h3>Welcome to ChatterBox</h3>
          <p>Select a conversation or start a new chat</p>
        </div>
      </div>
    );
  }

  const otherMember = getOtherMember();
  const chatName = currentConversation.name || otherMember?.displayName || 'Chat';
  const chatStatus = currentConversation.isGroup
    ? `${currentConversation.members.length} members`
    : otherMember?.status || 'offline';

  const handleViewProfile = (memberToView: User) => {
    setViewingUser(memberToView);
  };

  return (
    <div className="chat-area">
      <div 
        className={`chat-header ${!currentConversation.isGroup ? 'clickable' : ''}`}
        onClick={() => !currentConversation.isGroup && otherMember && handleViewProfile(otherMember)}
      >
        <div 
          className="conversation-avatar"
          style={!currentConversation.isGroup && otherMember?.avatar ? { backgroundImage: `url(${otherMember.avatar})`, backgroundSize: 'cover' } : {}}
        >
          {!(otherMember?.avatar && !currentConversation.isGroup) && (
            currentConversation.isGroup
              ? currentConversation.name?.[0] || 'G'
              : otherMember?.displayName?.[0]?.toUpperCase() || '?'
          )}
          {!currentConversation.isGroup && (
            <span className={`status-indicator ${otherMember?.status || 'offline'}`} />
          )}
        </div>
        <div className="chat-header-info">
          <h3>{chatName}</h3>
          <span>{chatStatus}</span>
        </div>
      </div>

      <div className="messages-container">
        {currentMessages.map((message, index) => {
          const isSent = message.senderId === user?.id;
          const showDate = shouldShowDateSeparator(message, index);

          return (
            <div key={message.id}>
              {showDate && (
                <div className="date-separator">
                  <span>{formatMessageDate(new Date(message.createdAt))}</span>
                </div>
              )}
              <div className={`message ${isSent ? 'sent' : 'received'}`}>
                {!isSent && (
                  <div className="message-avatar">
                    {message.senderName?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="message-content">
                  {!isSent && currentConversation.isGroup && (
                    <div className="message-sender">{message.senderName}</div>
                  )}

                  {message.type === 'image' && message.fileUrl && (
                    <img
                      src={message.fileUrl}
                      alt="Shared image"
                      className="message-image"
                      onClick={() => window.open(message.fileUrl!, '_blank')}
                    />
                  )}

                  {message.type === 'file' && message.fileUrl && (
                    <a
                      href={message.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="message-file"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                      </svg>
                      {message.fileName}
                    </a>
                  )}

                  {(message.type === 'text' || !message.fileUrl) && message.content && (
                    <div className="message-bubble">{message.content}</div>
                  )}

                  <div className="message-time">
                    {format(new Date(message.createdAt), 'HH:mm')}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {currentTypingUsers.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            {currentTypingUsers.map((t) => t.userName).join(', ')}{' '}
            {currentTypingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-container">
        <form className="message-input-form" onSubmit={handleSubmit}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="animate-spin">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
              </svg>
            )}
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Type a message..."
            autoFocus
          />
          <button type="submit" className="send-btn" disabled={!inputValue.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>

      {/* User Profile View Modal */}
      {viewingUser && (
        <UserProfileView user={viewingUser} onClose={() => setViewingUser(null)} />
      )}
    </div>
  );
}
