import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import database from './database';

const JWT_SECRET = process.env.JWT_SECRET || 'chatterbox-secret-key-change-in-production';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  status: string;
  createdAt: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export function register(username: string, password: string, displayName: string): AuthResult {
  try {
    const existing = database.findUserByUsername(username);
    if (existing) {
      return { success: false, error: 'Username already exists' };
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    const now = new Date().toISOString();

    database.createUser({
      id,
      username,
      password: hashedPassword,
      displayName,
      avatar: null,
      bio: null,
      status: 'online',
      createdAt: now,
    });

    const user: User = {
      id,
      username,
      displayName,
      avatar: null,
      bio: null,
      status: 'online',
      createdAt: now,
    };

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });

    return { success: true, user, token };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Registration failed' };
  }
}

export function login(username: string, password: string): AuthResult {
  try {
    const dbUser = database.findUserByUsername(username);

    if (!dbUser) {
      return { success: false, error: 'User not found' };
    }

    if (!bcrypt.compareSync(password, dbUser.password)) {
      return { success: false, error: 'Invalid password' };
    }

    // Update status to online
    database.updateUser(dbUser.id, { status: 'online' });

    const user: User = {
      id: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.displayName,
      avatar: dbUser.avatar,
      bio: dbUser.bio || null,
      status: 'online',
      createdAt: dbUser.createdAt,
    };

    const token = jwt.sign({ userId: dbUser.id }, JWT_SECRET, { expiresIn: '7d' });

    return { success: true, user, token };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

export function verifyToken(token: string): { valid: boolean; userId?: string } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return { valid: true, userId: decoded.userId };
  } catch {
    return { valid: false };
  }
}

export function getUserById(id: string): User | null {
  const dbUser = database.findUserById(id);
  if (!dbUser) return null;

  return {
    id: dbUser.id,
    username: dbUser.username,
    displayName: dbUser.displayName,
    avatar: dbUser.avatar,
    bio: dbUser.bio || null,
    status: dbUser.status,
    createdAt: dbUser.createdAt,
  };
}

export function updateUserStatus(userId: string, status: string): void {
  database.updateUser(userId, { status });
}

export function updateUserProfile(userId: string, updates: { displayName?: string; avatar?: string; bio?: string }): User | null {
  database.updateUser(userId, updates);
  return getUserById(userId);
}

export function searchUsers(query: string, excludeUserId: string): User[] {
  const users = database.searchUsers(query, excludeUserId);
  return users.map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar,
    bio: u.bio || null,
    status: u.status,
    createdAt: u.createdAt,
  }));
}
