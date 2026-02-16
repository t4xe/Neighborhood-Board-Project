import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDb } from './db';
import type { SessionUser, UserRole } from './types';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const db = getDb();
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, userId, expires);
  return token;
}

export function getSessionUser(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const db = getDb();
  const row = db.prepare(`
    SELECT u.user_id, u.email, u.display_name, u.roles, u.types, u.zone, u.status, u.created_at
    FROM users u
    JOIN sessions s ON s.user_id = u.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now') AND u.status = 'active'
  `).get(token) as Record<string, unknown> | undefined;
  if (!row) return null;
  const roles = (row.roles as string || 'regular').split(',').map((r: string) => r.trim()) as UserRole[];
  const types = (row.types as string || '').split(',').filter(Boolean).map((t: string) => t.trim());
  return {
    ...row,
    roleList: roles,
    typeList: types,
  } as SessionUser;
}

export function resolveAuth(req: Request): SessionUser | null {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    (req as Request & { cookies?: Record<string, string> }).cookies?.session;
  return getSessionUser(token);
}

export function authMiddleware(
  req: Request & { user?: SessionUser | null },
  _res: Response,
  next: NextFunction
): void {
  req.user = resolveAuth(req);
  next();
}

export function requireAuth(
  req: Request & { user?: SessionUser | null },
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    return;
  }
  next();
}

export function requireRole(...allowed: UserRole[]) {
  return (req: Request & { user?: SessionUser | null }, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const hasRole = req.user.roleList.some((r) => allowed.includes(r));
    if (!hasRole) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
