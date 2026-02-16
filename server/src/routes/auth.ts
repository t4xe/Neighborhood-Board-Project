import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { authMiddleware, createSession, requireAuth } from '../auth';
import type { SessionUser } from '../types';

/** Lower = faster login/register, higher = more secure. 8 is a good balance (10 is default but slow). */
const BCRYPT_ROUNDS = 8;

export const authRouter = Router();

// Register endpoint
authRouter.post('/register', (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'Email and password are required' });
    }

    if (!displayName || typeof displayName !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'Display name is required' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT user_id FROM users WHERE email = ?')
      .get(email.trim().toLowerCase()) as { user_id: number } | undefined;

    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Email already exists' });
    }

    const hashed = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO users (email, password_hash, display_name, roles, status, created_at)
      VALUES (?, ?, ?, 'regular', 'active', ?)
    `).run(email.trim().toLowerCase(), hashed, displayName.trim(), now);

    return res.status(201).json({
      message: 'Registration successful',
      user_id: result.lastInsertRowid
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Registration failed. Please try again.' });
  }
});

// Login endpoint
authRouter.post('/login', authMiddleware, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const { email, password } = req.body;
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'Bad Request', message: 'Email and password are required' });
    return;
  }
  const db = getDb();
  const user = db.prepare(
    'SELECT user_id, email, password_hash, display_name, roles, types, zone, status, created_at FROM users WHERE email = ? AND status = ?'
  ).get(email.trim().toLowerCase(), 'active') as Record<string, unknown> | undefined;
  
  if (!user || !bcrypt.compareSync(password, user.password_hash as string)) {
    res.status(401).json({ error: 'Unauthorized', message: 'Incorrect email or password' });
    return;
  }
  
  const token = createSession(user.user_id as number);
  const roleList = (user.roles as string || 'regular').split(',').map((r: string) => r.trim());
  const typeList = (user.types as string || '').split(',').filter(Boolean).map((t: string) => t.trim());
  
  // Map roles: 'administrator' -> 'admin', others -> 'user'
  const mappedRoleList = roleList.map(r => r === 'administrator' ? 'admin' : 'user');
  const isAdmin = mappedRoleList.includes('admin');
  
  res.status(200).json({
    token,
    user: {
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      roles: user.roles,
      types: user.types,
      zone: user.zone,
      status: user.status,
      created_at: user.created_at,
      roleList: mappedRoleList,
      typeList,
      isAdmin,
    },
  });
});

// Logout endpoint
authRouter.post('/logout', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.status(204).send();
});
