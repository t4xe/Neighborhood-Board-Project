import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth } from '../auth';
import type { SessionUser } from '../types';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  res.status(200).json({
    user_id: user.user_id,
    email: user.email,
    display_name: user.display_name,
    roles: user.roles,
    types: user.types,
    zone: user.zone,
    status: user.status,
    created_at: user.created_at,
    roleList: user.roleList ?? (user.roles || 'regular').split(',').map((r: string) => r.trim()),
    typeList: user.typeList ?? (user.types || '').split(',').filter(Boolean).map((t: string) => t.trim()),
  });
});
