import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb, logAudit } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'railtwin-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  displayName: string;
}

export interface AuthPayload {
  userId: number;
  username: string;
  role: string;
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(user: AuthUser): string {
  const payload: AuthPayload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function authenticate(request: Request): AuthPayload | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}

export function requireAuth(request: Request): AuthPayload {
  const user = authenticate(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return user;
}

export function login(username: string, password: string): { token: string; user: AuthUser } | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM operators WHERE username = ?').get(username) as any;
  if (!row || !verifyPassword(password, row.password_hash)) return null;

  const user: AuthUser = {
    id: row.id,
    username: row.username,
    role: row.role,
    displayName: row.display_name || row.username
  };

  const token = generateToken(user);
  logAudit('login', user.id, { username });

  return { token, user };
}

export function logout(token: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}
