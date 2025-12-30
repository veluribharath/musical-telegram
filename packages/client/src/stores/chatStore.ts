import { create } from 'zustand';
import { useAuthStore } from './authStore';

const API_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  status: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string | null;
  type: 'text' | 'image' | 'file';
  fileUrl: string | null;
  fileName: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  name: string | null;
  isGroup: boolean;
  members: User[];
  lastMessage: Message | null;
  createdAt: string;
  updatedAt: string;
}

interface TypingUser {
  conversationId: string;
  userId: string;
  userName: string;
}

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Record<string, Message[]>;
  typingUsers: TypingUser[];
  ws: WebSocket | null;
  isConnected: boolean;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  fetchConversations: () => Promise<void>;
  selectConversation: (conversation: Conversation) => Promise<void>;
  sendMessage: (content: string, type?: 'text' | 'image' | 'file', fileUrl?: string, fileName?: string) => void;
  createConversation: (memberIds: string[], name?: string, isGroup?: boolean) => Promise<Conversation | null>;
  searchUsers: (query: string) => Promise<User[]>;
  uploadFile: (file: File) => Promise<{ fileUrl: string; fileName: string; type: 'image' | 'file' } | null>;
  sendTyping: (isTyping: boolean) => void;
  updateUserStatus: (userId: string, status: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: {},
  typingUsers: [],
  ws: null,
  isConnected: false,

  connect: () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'auth_success':
          set({ isConnected: true });
          get().fetchConversations();
          break;

        case 'auth_error':
          console.error('WebSocket auth error:', data.error);
          ws.close();
          break;

        case 'new_message': {
          const message: Message = data.message;
          set((state) => {
            const convMessages = state.messages[message.conversationId] || [];
            
            // Avoid duplicates
            if (convMessages.some(m => m.id === message.id)) {
              return state;
            }

            // Update conversations list
            const updatedConversations = state.conversations.map(conv => {
              if (conv.id === message.conversationId) {
                return { ...conv, lastMessage: message };
              }
              return conv;
            });

            // Sort conversations by last message
            updatedConversations.sort((a, b) => {
              const aTime = a.lastMessage?.createdAt || a.updatedAt;
              const bTime = b.lastMessage?.createdAt || b.updatedAt;
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            });

            return {
              messages: {
                ...state.messages,
                [message.conversationId]: [...convMessages, message],
              },
              conversations: updatedConversations,
            };
          });
          break;
        }

        case 'typing': {
          const { conversationId, userId, userName, isTyping } = data;
          set((state) => {
            if (isTyping) {
              const exists = state.typingUsers.some(
                t => t.conversationId === conversationId && t.userId === userId
              );
              if (!exists) {
                return {
                  typingUsers: [...state.typingUsers, { conversationId, userId, userName }],
                };
              }
            } else {
              return {
                typingUsers: state.typingUsers.filter(
                  t => !(t.conversationId === conversationId && t.userId === userId)
                ),
              };
            }
            return state;
          });

          // Auto-remove typing indicator after 5 seconds
          setTimeout(() => {
            set((state) => ({
              typingUsers: state.typingUsers.filter(
                t => !(t.conversationId === conversationId && t.userId === userId)
              ),
            }));
          }, 5000);
          break;
        }

        case 'user_status': {
          const { userId, status } = data;
          get().updateUserStatus(userId, status);
          break;
        }

        case 'pong':
          // Heartbeat response
          break;
      }
    };

    ws.onclose = () => {
      set({ isConnected: false, ws: null });
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (useAuthStore.getState().token) {
          get().connect();
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    set({ ws });

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, isConnected: false });
    }
  },

  fetchConversations: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        set({ conversations: data.conversations });
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  },

  selectConversation: async (conversation: Conversation) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    set({ currentConversation: conversation });

    // Load messages if not already loaded
    if (!get().messages[conversation.id]) {
      try {
        const response = await fetch(`${API_URL}/api/conversations/${conversation.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          set((state) => ({
            messages: {
              ...state.messages,
              [conversation.id]: data.messages,
            },
          }));
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    }
  },

  sendMessage: (content: string, type: 'text' | 'image' | 'file' = 'text', fileUrl?: string, fileName?: string) => {
    const { ws, currentConversation } = get();
    if (!ws || !currentConversation || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'message',
      conversationId: currentConversation.id,
      content,
      messageType: type,
      fileUrl,
      fileName,
    }));
  },

  createConversation: async (memberIds: string[], name?: string, isGroup: boolean = false) => {
    const token = useAuthStore.getState().token;
    if (!token) return null;

    try {
      const response = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberIds, name, isGroup }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add to conversations if not exists
        set((state) => {
          const exists = state.conversations.some(c => c.id === data.conversation.id);
          if (!exists) {
            return { conversations: [data.conversation, ...state.conversations] };
          }
          return state;
        });

        return data.conversation;
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }

    return null;
  },

  searchUsers: async (query: string) => {
    const token = useAuthStore.getState().token;
    if (!token || !query.trim()) return [];

    try {
      const response = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        return data.users;
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    }

    return [];
  },

  uploadFile: async (file: File) => {
    const token = useAuthStore.getState().token;
    if (!token) return null;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return {
          fileUrl: `${API_URL}${data.fileUrl}`,
          fileName: data.fileName,
          type: data.type as 'image' | 'file',
        };
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
    }

    return null;
  },

  sendTyping: (isTyping: boolean) => {
    const { ws, currentConversation } = get();
    if (!ws || !currentConversation || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'typing',
      conversationId: currentConversation.id,
      isTyping,
    }));
  },

  updateUserStatus: (userId: string, status: string) => {
    set((state) => ({
      conversations: state.conversations.map(conv => ({
        ...conv,
        members: conv.members.map(member =>
          member.id === userId ? { ...member, status } : member
        ),
      })),
      currentConversation: state.currentConversation
        ? {
            ...state.currentConversation,
            members: state.currentConversation.members.map(member =>
              member.id === userId ? { ...member, status } : member
            ),
          }
        : null,
    }));
  },
}));
