import { v4 as uuidv4 } from 'uuid';
import database from './database';
import { User, getUserById } from './auth';

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

export function createConversation(
  memberIds: string[],
  name: string | null = null,
  isGroup: boolean = false
): Conversation | null {
  try {
    // For direct messages, check if conversation already exists
    if (!isGroup && memberIds.length === 2) {
      const existing = database.findDirectConversation(memberIds[0], memberIds[1]);
      if (existing) {
        return getConversation(existing.id);
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    database.createConversation({
      id,
      name,
      isGroup,
      createdAt: now,
      updatedAt: now,
    });

    for (const userId of memberIds) {
      database.addConversationMember({
        conversationId: id,
        userId,
        joinedAt: now,
      });
    }

    return getConversation(id);
  } catch (error) {
    console.error('Create conversation error:', error);
    return null;
  }
}

export function getConversation(id: string): Conversation | null {
  try {
    const conv = database.findConversationById(id);
    if (!conv) return null;

    const memberIds = database.getConversationMembers(id);
    const members: User[] = [];
    for (const memberId of memberIds) {
      const user = getUserById(memberId);
      if (user) members.push(user);
    }

    const lastMsg = database.getLastMessage(id);
    let lastMessage: Message | null = null;
    
    if (lastMsg) {
      const sender = getUserById(lastMsg.senderId);
      lastMessage = {
        id: lastMsg.id,
        conversationId: lastMsg.conversationId,
        senderId: lastMsg.senderId,
        senderName: sender?.displayName || 'Unknown',
        senderAvatar: sender?.avatar || null,
        content: lastMsg.content,
        type: lastMsg.type,
        fileUrl: lastMsg.fileUrl,
        fileName: lastMsg.fileName,
        createdAt: lastMsg.createdAt,
      };
    }

    return {
      id: conv.id,
      name: conv.name,
      isGroup: conv.isGroup,
      members,
      lastMessage,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    };
  } catch (error) {
    console.error('Get conversation error:', error);
    return null;
  }
}

export function getUserConversations(userId: string): Conversation[] {
  try {
    const convIds = database.getUserConversationIds(userId);
    const conversations: Conversation[] = [];
    
    for (const convId of convIds) {
      const conv = getConversation(convId);
      if (conv) conversations.push(conv);
    }

    // Sort by last message or updatedAt
    conversations.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || a.updatedAt;
      const bTime = b.lastMessage?.createdAt || b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    return conversations;
  } catch (error) {
    console.error('Get user conversations error:', error);
    return [];
  }
}

export function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: 'text' | 'image' | 'file' = 'text',
  fileUrl: string | null = null,
  fileName: string | null = null
): Message | null {
  try {
    const id = uuidv4();
    const now = new Date().toISOString();

    database.createMessage({
      id,
      conversationId,
      senderId,
      content,
      type,
      fileUrl,
      fileName,
      createdAt: now,
    });

    database.updateConversation(conversationId, { updatedAt: now });

    const sender = getUserById(senderId);

    return {
      id,
      conversationId,
      senderId,
      senderName: sender?.displayName || 'Unknown',
      senderAvatar: sender?.avatar || null,
      content,
      type,
      fileUrl,
      fileName,
      createdAt: now,
    };
  } catch (error) {
    console.error('Send message error:', error);
    return null;
  }
}

export function getMessages(conversationId: string, limit: number = 50, before?: string): Message[] {
  try {
    const msgs = database.getMessages(conversationId, limit, before);
    
    return msgs.map(msg => {
      const sender = getUserById(msg.senderId);
      return {
        id: msg.id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        senderName: sender?.displayName || 'Unknown',
        senderAvatar: sender?.avatar || null,
        content: msg.content,
        type: msg.type,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        createdAt: msg.createdAt,
      };
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return [];
  }
}

export function getConversationMembers(conversationId: string): string[] {
  return database.getConversationMembers(conversationId);
}

export function addMemberToConversation(conversationId: string, userId: string): boolean {
  try {
    database.addConversationMember({
      conversationId,
      userId,
      joinedAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}
