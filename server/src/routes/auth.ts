import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { authMiddleware, createSession, requireAuth } from '../auth';
import type { SessionUser } from '../types';

export const authRouter = Router();

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
      roleList,
      typeList,
    },
  });
});

authRouter.post('/logout', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.status(204).send();
});
