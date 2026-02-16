import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { requireAuth, requireRole } from '../auth';
import { broadcast } from '../live';
import type { SessionUser } from '../types';

export const usersRouter = Router();

// Get current user profile
usersRouter.get('/me', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const roleList = user.roleList ?? (user.roles || 'regular').split(',').map((r: string) => r.trim());
  // Map roles: 'administrator' -> 'admin', others -> 'user'
  const mappedRoleList = roleList.map(r => r === 'administrator' ? 'admin' : 'user');
  const isAdmin = mappedRoleList.includes('admin');
  
  res.status(200).json({
    user_id: user.user_id,
    email: user.email,
    display_name: user.display_name,
    roles: user.roles,
    types: user.types,
    zone: user.zone,
    status: user.status,
    created_at: user.created_at,
    roleList: mappedRoleList,
    typeList: user.typeList ?? (user.types || '').split(',').filter(Boolean).map((t: string) => t.trim()),
    isAdmin: isAdmin,
  });
});

// Update current user profile (user can update their own)
usersRouter.put('/me', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const { displayName, password, zone } = req.body;
  const db = getDb();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (displayName !== undefined && typeof displayName === 'string' && displayName.trim()) {
    updates.push('display_name = ?');
    values.push(displayName.trim());
  }

  if (password !== undefined && typeof password === 'string' && password.length >= 6) {
    const hashed = bcrypt.hashSync(password, 8);
    updates.push('password_hash = ?');
    values.push(hashed);
  }

  if (zone !== undefined && typeof zone === 'string') {
    updates.push('zone = ?');
    values.push(zone.trim());
  }

  if (updates.length === 0) {
    const current = db.prepare('SELECT * FROM users WHERE user_id = ?').get(user.user_id) as Record<string, unknown>;
    return res.status(200).json(current);
  }

  values.push(user.user_id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
  broadcast('users:changed');
  const updated = db.prepare('SELECT user_id, email, display_name, roles, types, zone, status, created_at FROM users WHERE user_id = ?')
    .get(user.user_id) as Record<string, unknown>;
  res.status(200).json(updated);
});

// Admin-only: Get all users
usersRouter.get('/', requireAuth, requireRole('administrator'), (req: Request & { user?: SessionUser | null }, res: Response) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT user_id, email, display_name, roles, types, zone, status, created_at
    FROM users
    ORDER BY created_at DESC
  `).all() as Record<string, unknown>[];
  
  const mappedUsers = users.map(u => {
    const roleList = (u.roles as string || 'regular').split(',').map((r: string) => r.trim());
    const mappedRoleList = roleList.map(r => r === 'administrator' ? 'admin' : 'user');
    return {
      ...u,
      roleList: mappedRoleList,
      isAdmin: mappedRoleList.includes('admin'),
    };
  });
  
  res.status(200).json(mappedUsers);
});

// Admin-only: Update user
usersRouter.put('/:userId', requireAuth, requireRole('administrator'), async (req: Request & { user?: SessionUser | null }, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid user ID' });
  }
  
  const db = getDb();
  const user = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found' });
  }

  const { displayName, roles, status, zone } = req.body;
  const updates: string[] = [];
  const values: unknown[] = [];

  if (displayName !== undefined && typeof displayName === 'string' && displayName.trim()) {
    updates.push('display_name = ?');
    values.push(displayName.trim());
  }

  if (roles !== undefined && typeof roles === 'string') {
    updates.push('roles = ?');
    values.push(roles.trim());
  }

  if (status !== undefined && ['active', 'suspended', 'deleted'].includes(status)) {
    updates.push('status = ?');
    values.push(status);
  }

  if (zone !== undefined && typeof zone === 'string') {
    updates.push('zone = ?');
    values.push(zone.trim());
  }

  if (updates.length === 0) {
    const current = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId) as Record<string, unknown>;
    return res.status(200).json(current);
  }

  values.push(userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
  broadcast('users:changed');
  const updated = db.prepare('SELECT user_id, email, display_name, roles, types, zone, status, created_at FROM users WHERE user_id = ?')
    .get(userId) as Record<string, unknown>;
  res.status(200).json(updated);
});

// Admin-only: Delete user (soft delete)
usersRouter.delete('/:userId', requireAuth, requireRole('administrator'), (req: Request & { user?: SessionUser | null }, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid user ID' });
  }
  
  const db = getDb();
  const user = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found' });
  }

  db.prepare("UPDATE users SET status = 'deleted' WHERE user_id = ?").run(userId);
  res.status(204).send();
});
