import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware } from '../auth';

export const categoriesRouter = Router();

categoriesRouter.get('/', authMiddleware, (_req: Request, res: Response) => {
  const rows = getDb().prepare(`
    SELECT category_id, name, description, rules
    FROM categories
    ORDER BY name
  `).all();
  res.status(200).json(rows);
});
