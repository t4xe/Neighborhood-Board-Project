import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware, requireAuth, requireRole } from '../auth';
import { broadcast } from '../live';

export const categoriesRouter = Router();

categoriesRouter.get('/', authMiddleware, (_req: Request, res: Response) => {
  const rows = getDb().prepare(`
    SELECT category_id, name, description, rules
    FROM categories
    ORDER BY name
  `).all();
  res.status(200).json(rows);
});

categoriesRouter.post('/', requireAuth, requireRole('administrator'), (req: Request, res: Response) => {
  const { name, description, rules } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Category name is required' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT category_id FROM categories WHERE name = ?').get(name.trim());
  if (existing) {
    return res.status(409).json({ error: 'Conflict', message: 'Category name already exists' });
  }
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO categories (name, description, rules, created_at)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), (description && typeof description === 'string' ? description.trim() : '') || '', (rules && typeof rules === 'string' ? rules.trim() : '') || '', now);
  const row = db.prepare('SELECT category_id, name, description, rules FROM categories WHERE category_id = ?')
    .get(result.lastInsertRowid) as Record<string, unknown>;
  broadcast('categories:changed');
  res.status(201).json(row);
});
