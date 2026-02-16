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

categoriesRouter.put('/:categoryId', requireAuth, requireRole('administrator'), (req: Request, res: Response) => {
  const categoryId = parseInt(req.params.categoryId, 10);
  const { name, description, rules } = req.body;
  if (isNaN(categoryId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid category ID' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT category_id FROM categories WHERE category_id = ?').get(categoryId);
  if (!existing) {
    return res.status(404).json({ error: 'Not Found', message: 'Category not found' });
  }
  const updates: string[] = [];
  const values: unknown[] = [];
  if (name !== undefined && typeof name === 'string' && name.trim()) {
    const other = db.prepare('SELECT category_id FROM categories WHERE name = ? AND category_id != ?').get(name.trim(), categoryId);
    if (other) return res.status(409).json({ error: 'Conflict', message: 'Category name already exists' });
    updates.push('name = ?');
    values.push(name.trim());
  }
  if (description !== undefined && typeof description === 'string') {
    updates.push('description = ?');
    values.push(description.trim());
  }
  if (rules !== undefined && typeof rules === 'string') {
    updates.push('rules = ?');
    values.push(rules.trim());
  }
  if (updates.length === 0) {
    const row = db.prepare('SELECT category_id, name, description, rules FROM categories WHERE category_id = ?').get(categoryId) as Record<string, unknown>;
    return res.status(200).json(row);
  }
  values.push(categoryId);
  db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE category_id = ?`).run(...values);
  broadcast('categories:changed');
  const row = db.prepare('SELECT category_id, name, description, rules FROM categories WHERE category_id = ?').get(categoryId) as Record<string, unknown>;
  res.status(200).json(row);
});

categoriesRouter.delete('/:categoryId', requireAuth, requireRole('administrator'), (req: Request, res: Response) => {
  const categoryId = parseInt(req.params.categoryId, 10);
  if (isNaN(categoryId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid category ID' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT category_id FROM categories WHERE category_id = ?').get(categoryId);
  if (!existing) {
    return res.status(404).json({ error: 'Not Found', message: 'Category not found' });
  }
  const postsCount = db.prepare('SELECT COUNT(*) as c FROM posts WHERE category_id = ?').get(categoryId) as { c: number };
  if (postsCount.c > 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Cannot delete category that has posts' });
  }
  db.prepare('DELETE FROM categories WHERE category_id = ?').run(categoryId);
  broadcast('categories:changed');
  res.status(204).send();
});
