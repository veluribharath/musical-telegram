import fs from 'fs';
import path from 'path';

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'chatterbox.json');

export interface User {
  id: string;
  username: string;
  password: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  status: string;
  createdAt: string;
}

export interface ConversationMember {
  conversationId: string;
  userId: string;
  joinedAt: string;
}

export interface Conversation {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  type: 'text' | 'image' | 'file';
  fileUrl: string | null;
  fileName: string | null;
  createdAt: string;
}

interface Database {
  users: User[];
  conversations: Conversation[];
  conversationMembers: ConversationMember[];
  messages: Message[];
}

const defaultDb: Database = {
  users: [],
  conversations: [],
  conversationMembers: [],
  messages: [],
};

function loadDb(): Database {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading database:', error);
  }
  return { ...defaultDb };
}

function saveDb(db: Database): void {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// In-memory database with file persistence
let db = loadDb();

export const database = {
  // Users
  findUserByUsername(username: string): User | undefined {
    return db.users.find(u => u.username === username);
  },

  findUserById(id: string): User | undefined {
    return db.users.find(u => u.id === id);
  },

  createUser(user: User): void {
    db.users.push(user);
    saveDb(db);
  },

  updateUser(id: string, updates: Partial<User>): void {
    const user = db.users.find(u => u.id === id);
    if (user) {
      Object.assign(user, updates);
      saveDb(db);
    }
  },

  searchUsers(query: string, excludeUserId: string): User[] {
    const lowerQuery = query.toLowerCase();
    return db.users.filter(u => 
      u.id !== excludeUserId && 
      (u.username.toLowerCase().includes(lowerQuery) || 
       u.displayName.toLowerCase().includes(lowerQuery))
    ).slice(0, 20);
  },

  // Conversations
  findConversationById(id: string): Conversation | undefined {
    return db.conversations.find(c => c.id === id);
  },

  findDirectConversation(userId1: string, userId2: string): Conversation | undefined {
    // Find a non-group conversation where both users are members
    for (const conv of db.conversations) {
      if (!conv.isGroup) {
        const members = db.conversationMembers.filter(m => m.conversationId === conv.id);
        if (members.length === 2 && 
            members.some(m => m.userId === userId1) && 
            members.some(m => m.userId === userId2)) {
          return conv;
        }
      }
    }
    return undefined;
  },

  createConversation(conversation: Conversation): void {
    db.conversations.push(conversation);
    saveDb(db);
  },

  updateConversation(id: string, updates: Partial<Conversation>): void {
    const conv = db.conversations.find(c => c.id === id);
    if (conv) {
      Object.assign(conv, updates);
      saveDb(db);
    }
  },

  getUserConversationIds(userId: string): string[] {
    return db.conversationMembers
      .filter(m => m.userId === userId)
      .map(m => m.conversationId);
  },

  // Conversation Members
  getConversationMembers(conversationId: string): string[] {
    return db.conversationMembers
      .filter(m => m.conversationId === conversationId)
      .map(m => m.userId);
  },

  addConversationMember(member: ConversationMember): void {
    const existing = db.conversationMembers.find(
      m => m.conversationId === member.conversationId && m.userId === member.userId
    );
    if (!existing) {
      db.conversationMembers.push(member);
      saveDb(db);
    }
  },

  // Messages
  getMessages(conversationId: string, limit: number = 50, before?: string): Message[] {
    let messages = db.messages.filter(m => m.conversationId === conversationId);
    
    if (before) {
      messages = messages.filter(m => m.createdAt < before);
    }
    
    return messages
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .reverse();
  },

  getLastMessage(conversationId: string): Message | undefined {
    const messages = db.messages.filter(m => m.conversationId === conversationId);
    return messages.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  },

  createMessage(message: Message): void {
    db.messages.push(message);
    saveDb(db);
  },
};

export default database;
