import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import { register, login, verifyToken, getUserById, updateUserStatus, updateUserProfile, searchUsers, User } from './auth';
import {
  createConversation,
  getUserConversations,
  getConversation,
  sendMessage,
  getMessages,
  getConversationMembers,
  addMemberToConversation,
  Message
} from './conversations';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// File uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

app.use('/uploads', express.static(uploadsDir));

// Connected clients map: userId -> WebSocket[]
const clients = new Map<string, WebSocket[]>();

// Auth middleware for HTTP
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const { valid, userId } = verifyToken(token);
  
  if (!valid || !userId) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  (req as any).userId = userId;
  next();
}

// HTTP Routes
app.post('/api/auth/register', (req, res) => {
  const { username, password, displayName } = req.body;
  
  if (!username || !password || !displayName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const result = register(username, password, displayName);
  if (result.success) {
    res.json({ user: result.user, token: result.token });
  } else {
    res.status(400).json({ error: result.error });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const result = login(username, password);
  if (result.success) {
    res.json({ user: result.user, token: result.token });
  } else {
    res.status(400).json({ error: result.error });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = getUserById((req as any).userId);
  if (user) {
    res.json({ user });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const { displayName, avatar, bio } = req.body;
  const userId = (req as any).userId;

  if (!displayName) {
    return res.status(400).json({ error: 'Display name is required' });
  }

  const user = updateUserProfile(userId, { displayName, avatar, bio });
  if (user) {
    res.json({ user });
  } else {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/api/users/search', authMiddleware, (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    return res.json({ users: [] });
  }
  
  const users = searchUsers(query, (req as any).userId);
  res.json({ users });
});

app.get('/api/conversations', authMiddleware, (req, res) => {
  const conversations = getUserConversations((req as any).userId);
  res.json({ conversations });
});

app.post('/api/conversations', authMiddleware, (req, res) => {
  const { memberIds, name, isGroup } = req.body;
  const userId = (req as any).userId;
  
  if (!memberIds || !Array.isArray(memberIds)) {
    return res.status(400).json({ error: 'memberIds required' });
  }

  // Ensure current user is included
  const allMembers = [...new Set([userId, ...memberIds])];
  
  const conversation = createConversation(allMembers, name, isGroup);
  if (conversation) {
    res.json({ conversation });
  } else {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

app.get('/api/conversations/:id', authMiddleware, (req, res) => {
  const conversation = getConversation(req.params.id);
  if (conversation) {
    res.json({ conversation });
  } else {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

app.get('/api/conversations/:id/messages', authMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const before = req.query.before as string;
  
  const messages = getMessages(req.params.id, limit, before);
  res.json({ messages });
});

app.post('/api/conversations/:id/members', authMiddleware, (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  
  const success = addMemberToConversation(req.params.id, userId);
  if (success) {
    const conversation = getConversation(req.params.id);
    res.json({ conversation });
  } else {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const isImage = req.file.mimetype.startsWith('image/');
  
  res.json({
    fileUrl,
    fileName: req.file.originalname,
    type: isImage ? 'image' : 'file'
  });
});

// WebSocket handling
interface WSClient {
  ws: WebSocket;
  userId: string;
  user: User;
}

function broadcast(userIds: string[], message: object) {
  const payload = JSON.stringify(message);
  for (const userId of userIds) {
    const userClients = clients.get(userId);
    if (userClients) {
      for (const ws of userClients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  }
}

wss.on('connection', (ws, req) => {
  let authenticated = false;
  let currentUserId: string | null = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'auth': {
          const { valid, userId } = verifyToken(message.token);
          if (valid && userId) {
            authenticated = true;
            currentUserId = userId;
            
            // Add to clients map
            const userClients = clients.get(userId) || [];
            userClients.push(ws);
            clients.set(userId, userClients);

            // Update user status
            updateUserStatus(userId, 'online');

            const user = getUserById(userId);
            ws.send(JSON.stringify({ type: 'auth_success', user }));

            // Notify friends about online status
            const conversations = getUserConversations(userId);
            const friendIds = new Set<string>();
            for (const conv of conversations) {
              for (const member of conv.members) {
                if (member.id !== userId) {
                  friendIds.add(member.id);
                }
              }
            }
            broadcast(Array.from(friendIds), {
              type: 'user_status',
              userId,
              status: 'online'
            });
          } else {
            ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }));
          }
          break;
        }

        case 'message': {
          if (!authenticated || !currentUserId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));
            return;
          }

          const { conversationId, content, messageType, fileUrl, fileName } = message;
          const msg = sendMessage(
            conversationId,
            currentUserId,
            content,
            messageType || 'text',
            fileUrl,
            fileName
          );

          if (msg) {
            // Broadcast to all conversation members
            const memberIds = getConversationMembers(conversationId);
            broadcast(memberIds, { type: 'new_message', message: msg });
          }
          break;
        }

        case 'typing': {
          if (!authenticated || !currentUserId) return;

          const { conversationId, isTyping } = message;
          const user = getUserById(currentUserId);
          const memberIds = getConversationMembers(conversationId);
          
          broadcast(
            memberIds.filter(id => id !== currentUserId),
            {
              type: 'typing',
              conversationId,
              userId: currentUserId,
              userName: user?.displayName,
              isTyping
            }
          );
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (currentUserId) {
      // Remove from clients map
      const userClients = clients.get(currentUserId);
      if (userClients) {
        const index = userClients.indexOf(ws);
        if (index > -1) {
          userClients.splice(index, 1);
        }
        if (userClients.length === 0) {
          clients.delete(currentUserId);
          updateUserStatus(currentUserId, 'offline');

          // Notify friends about offline status
          const conversations = getUserConversations(currentUserId);
          const friendIds = new Set<string>();
          for (const conv of conversations) {
            for (const member of conv.members) {
              if (member.id !== currentUserId) {
                friendIds.add(member.id);
              }
            }
          }
          broadcast(Array.from(friendIds), {
            type: 'user_status',
            userId: currentUserId,
            status: 'offline'
          });
        } else {
          clients.set(currentUserId, userClients);
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 ChatterBox server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
});
