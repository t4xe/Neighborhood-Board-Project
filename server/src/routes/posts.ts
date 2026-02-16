import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware, requireAuth, requireRole } from '../auth';
import { broadcast } from '../live';
import type { SessionUser } from '../types';
import type { PostStatus } from '../types';

export const postsRouter = Router();

const VALID_STATUS: PostStatus[] = ['active', 'inactive', 'resolved', 'archived'];
const VALID_REACTIONS = ['helpful', 'interested', 'congratulations', 'sold'];
const DEFAULT_EXPIRY_DAYS = 30;

function parsePagination(q: Record<string, unknown>) {
  const page = Math.max(0, parseInt(String(q.page || 0), 10) || 0);
  const size = Math.min(100, Math.max(1, parseInt(String(q.size || 20), 10) || 20));
  const sort = String(q.sort || 'created_at,desc').trim();
  return { page, size, sort };
}

postsRouter.get('/', authMiddleware, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const db = getDb();
  const { page, size, sort } = parsePagination(req.query as Record<string, unknown>);
  const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId), 10) : null;
  const zone = typeof req.query.zone === 'string' && req.query.zone.trim() ? req.query.zone.trim() : null;

  let orderBy = 'p.created_at DESC';
  const [sortField, sortDir] = sort.split(',');
  if (sortField && ['created_at', 'updated_at', 'title'].includes(sortField)) {
    orderBy = `p.${sortField} ${sortDir === 'asc' ? 'ASC' : 'DESC'}`;
  }

  let where = "p.status IN ('active','resolved') AND (p.expires_at IS NULL OR datetime(p.expires_at) > datetime('now'))";
  const params: (string | number)[] = [];
  if (categoryId != null && !isNaN(categoryId)) {
    where += ' AND p.category_id = ?';
    params.push(categoryId);
  }
  if (zone) {
    where += ' AND p.zone = ?';
    params.push(zone);
  }

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM posts p WHERE ${where}
  `).get(...params) as { total: number };
  const total = countRow.total;

  const offset = page * size;
  params.push(size, offset);
  const rows = db.prepare(`
    SELECT p.post_id, p.author_id, p.category_id, p.title, p.description, p.price, p.zone, p.geo_point,
           p.status, p.expires_at, p.created_at, p.updated_at,
           u.display_name as author_name,
           c.name as category_name
    FROM posts p
    JOIN users u ON u.user_id = p.author_id
    JOIN categories c ON c.category_id = p.category_id
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params) as Record<string, unknown>[];

  const postIds = rows.map((r) => r.post_id);
  let reactionsByPost: Record<number, unknown[]> = {};
  let reactionCountsByPost: Record<number, Record<string, number>> = {};
  if (postIds.length > 0) {
    const placeholders = postIds.map(() => '?').join(',');
    const allReactions = db.prepare(`
      SELECT post_id, type FROM reactions WHERE post_id IN (${placeholders})
    `).all(...postIds) as { post_id: number; type: string }[];
    reactionCountsByPost = allReactions.reduce((acc, r) => {
      if (!acc[r.post_id]) acc[r.post_id] = {};
      acc[r.post_id][r.type] = (acc[r.post_id][r.type] || 0) + 1;
      return acc;
    }, {} as Record<number, Record<string, number>>);
    if (req.user) {
      const myReactionsList = db.prepare(`
        SELECT post_id, type FROM reactions WHERE post_id IN (${placeholders}) AND author_id = ?
      `).all(...postIds, req.user.user_id) as { post_id: number; type: string }[];
      reactionsByPost = myReactionsList.reduce((acc, r) => {
        if (!acc[r.post_id]) acc[r.post_id] = [];
        acc[r.post_id].push(r.type);
        return acc;
      }, {} as Record<number, unknown[]>);
    }
  }

  const items = rows.map((r) => ({
    ...r,
    myReactions: reactionsByPost[r.post_id as number] || [],
    reactionCounts: reactionCountsByPost[r.post_id as number] || {},
  }));

  res.status(200).json({ content: items, total, page, size });
});

postsRouter.get('/admin/all', authMiddleware, requireRole('administrator'), (req: Request & { user?: SessionUser | null }, res: Response) => {
  const db = getDb();
  const { page, size, sort } = parsePagination(req.query as Record<string, unknown>);
  const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId), 10) : null;
  let orderBy = 'p.created_at DESC';
  const [sortField, sortDir] = sort.split(',');
  if (sortField && ['created_at', 'updated_at', 'title'].includes(sortField)) {
    orderBy = `p.${sortField} ${sortDir === 'asc' ? 'ASC' : 'DESC'}`;
  }
  let where = "1=1";
  const params: (string | number)[] = [];
  if (categoryId != null && !isNaN(categoryId)) {
    where += ' AND p.category_id = ?';
    params.push(categoryId);
  }
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM posts p WHERE ${where}`).get(...params) as { total: number };
  const total = countRow.total;
  const offset = page * size;
  params.push(size, offset);
  const rows = db.prepare(`
    SELECT p.post_id, p.author_id, p.category_id, p.title, p.description, p.price, p.zone, p.status, p.expires_at, p.created_at, p.updated_at,
           u.display_name as author_name, c.name as category_name
    FROM posts p
    JOIN users u ON u.user_id = p.author_id
    JOIN categories c ON c.category_id = p.category_id
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params) as Record<string, unknown>[];
  res.status(200).json({ content: rows, total, page, size });
});

postsRouter.post('/', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const { title, description, categoryId, zone, price } = req.body;
  if (!title || typeof title !== 'string' || !description || typeof description !== 'string') {
    res.status(400).json({ error: 'Bad Request', message: 'Title and description are required' });
    return;
  }
  const catId = categoryId != null ? parseInt(String(categoryId), 10) : NaN;
  if (isNaN(catId)) {
    res.status(400).json({ error: 'Bad Request', message: 'Valid categoryId is required' });
    return;
  }
  const zoneStr = typeof zone === 'string' ? zone.trim() : '';
  if (!zoneStr) {
    res.status(400).json({ error: 'Bad Request', message: 'Zone is required' });
    return;
  }
  const db = getDb();
  const cat = db.prepare('SELECT category_id FROM categories WHERE category_id = ?').get(catId);
  if (!cat) {
    res.status(400).json({ error: 'Bad Request', message: 'Category not found' });
    return;
  }
  const priceNum = price != null ? parseFloat(String(price)) : null;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = db.prepare(`
    INSERT INTO posts (author_id, category_id, title, description, price, zone, status, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(user.user_id, catId, title.trim().slice(0, 500), description.trim().slice(0, 5000), priceNum, zoneStr, expiresAt, now, now);
  const postId = result.lastInsertRowid;
  const row = db.prepare(`
    SELECT p.*, u.display_name as author_name, c.name as category_name
    FROM posts p
    JOIN users u ON u.user_id = p.author_id
    JOIN categories c ON c.category_id = p.category_id
    WHERE p.post_id = ?
  `).get(postId) as Record<string, unknown>;
  broadcast('posts:changed');
  res.status(201).json(row);
});

postsRouter.get('/:postId', authMiddleware, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const postId = parseInt(req.params.postId, 10);
  if (isNaN(postId)) {
    res.status(400).json({ error: 'Bad Request', message: 'Invalid post ID' });
    return;
  }
  const db = getDb();
  const row = db.prepare(`
    SELECT p.*, u.display_name as author_name, c.name as category_name
    FROM posts p
    JOIN users u ON u.user_id = p.author_id
    JOIN categories c ON c.category_id = p.category_id
    WHERE p.post_id = ?
  `).get(postId) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Not Found', message: 'Post not found' });
    return;
  }
  const comments = db.prepare(`
    SELECT c.comment_id, c.post_id, c.author_id, c.body, c.created_at, c.edited_at, u.display_name as author_name
    FROM comments c
    JOIN users u ON u.user_id = c.author_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(postId) as Record<string, unknown>[];
  const reactions = db.prepare(`
    SELECT r.reaction_id, r.type, r.author_id, r.created_at, u.display_name as author_name
    FROM reactions r
    JOIN users u ON u.user_id = r.author_id
    WHERE r.post_id = ?
  `).all(postId) as Record<string, unknown>[];
  const reactionCounts = (reactions as { type: string }[]).reduce((acc: Record<string, number>, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});
  let myReactions: unknown[] = [];
  if (req.user) {
    const mine = db.prepare('SELECT type FROM reactions WHERE post_id = ? AND author_id = ?')
      .all(postId, req.user.user_id) as { type: string }[];
    myReactions = mine.map((m) => m.type);
  }
  res.status(200).json({ ...row, comments, reactions, reactionCounts, myReactions });
});

postsRouter.put('/:postId', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const postId = parseInt(req.params.postId, 10);
  if (isNaN(postId)) {
    res.status(400).json({ error: 'Bad Request', message: 'Invalid post ID' });
    return;
  }
  const db = getDb();
  const post = db.prepare('SELECT author_id, created_at FROM posts WHERE post_id = ?').get(postId) as { author_id: number; created_at: string } | undefined;
  if (!post) {
    res.status(404).json({ error: 'Not Found', message: 'Post not found' });
    return;
  }
  const isOwner = post.author_id === user.user_id;
  const isAdmin = user.roleList.includes('administrator');
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'Forbidden', message: 'Not the post owner or admin' });
    return;
  }
  const { title, description, price, zone, status } = req.body;
  const updates: string[] = [];
  const values: unknown[] = [];
  if (title !== undefined && typeof title === 'string') {
    updates.push('title = ?');
    values.push(title.trim().slice(0, 500));
  }
  if (description !== undefined && typeof description === 'string') {
    updates.push('description = ?');
    values.push(description.trim().slice(0, 5000));
  }
  if (price !== undefined) {
    updates.push('price = ?');
    values.push(price == null ? null : parseFloat(String(price)));
  }
  if (zone !== undefined && typeof zone === 'string') {
    updates.push('zone = ?');
    values.push(zone.trim());
  }
  if (status !== undefined && VALID_STATUS.includes(status)) {
    if (isAdmin) {
      updates.push('status = ?');
      values.push(status);
    } else if (isOwner && (status === 'inactive' || status === 'resolved' || status === 'active')) {
      updates.push('status = ?');
      values.push(status);
    }
  }
  if (updates.length === 0) {
    const row = db.prepare(`
      SELECT p.*, u.display_name as author_name, c.name as category_name
      FROM posts p JOIN users u ON u.user_id = p.author_id JOIN categories c ON c.category_id = p.category_id
      WHERE p.post_id = ?
    `).get(postId) as Record<string, unknown>;
    return res.status(200).json(row);
  }
  updates.push("updated_at = datetime('now')");
  values.push(postId);
  db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE post_id = ?`).run(...values);
  broadcast('posts:changed');
  const row = db.prepare(`
    SELECT p.*, u.display_name as author_name, c.name as category_name
    FROM posts p JOIN users u ON u.user_id = p.author_id JOIN categories c ON c.category_id = p.category_id
    WHERE p.post_id = ?
  `).get(postId) as Record<string, unknown>;
  res.status(200).json(row);
});

postsRouter.patch('/:postId/inactive', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const postId = parseInt(req.params.postId, 10);
  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid post ID' });
  }
  const db = getDb();
  const post = db.prepare('SELECT author_id FROM posts WHERE post_id = ?').get(postId) as { author_id: number } | undefined;
  if (!post || post.author_id !== user.user_id) {
    return res.status(403).json({ error: 'Forbidden', message: 'Only the post owner can mark it inactive' });
  }
  db.prepare("UPDATE posts SET status = 'inactive', updated_at = datetime('now') WHERE post_id = ?").run(postId);
  broadcast('posts:changed');
  res.status(200).json({ message: 'Post marked inactive' });
});

postsRouter.patch('/:postId/active', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const postId = parseInt(req.params.postId, 10);
  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid post ID' });
  }
  const db = getDb();
  const post = db.prepare('SELECT author_id, status FROM posts WHERE post_id = ?').get(postId) as { author_id: number; status: string } | undefined;
  if (!post) {
    return res.status(404).json({ error: 'Not Found', message: 'Post not found' });
  }
  const isAdmin = user.roleList.includes('administrator');
  if (post.author_id !== user.user_id && !isAdmin) {
    return res.status(403).json({ error: 'Forbidden', message: 'Only the post owner or admin can reactivate' });
  }
  if (post.status !== 'inactive') {
    return res.status(400).json({ error: 'Bad Request', message: 'Post is not inactive' });
  }
  db.prepare("UPDATE posts SET status = 'active', updated_at = datetime('now') WHERE post_id = ?").run(postId);
  broadcast('posts:changed');
  res.status(200).json({ message: 'Post reactivated' });
});

postsRouter.delete('/:postId', requireAuth, requireRole('administrator'), (req: Request & { user?: SessionUser | null }, res: Response) => {
  const postId = parseInt(req.params.postId, 10);
  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid post ID' });
  }
  const db = getDb();
  const post = db.prepare('SELECT post_id FROM posts WHERE post_id = ?').get(postId);
  if (!post) {
    return res.status(404).json({ error: 'Not Found', message: 'Post not found' });
  }
  db.prepare('DELETE FROM posts WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
  db.prepare('DELETE FROM reactions WHERE post_id = ?').run(postId);
  broadcast('posts:changed');
  res.status(204).send();
});

postsRouter.post('/:postId/comments', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const postId = parseInt(req.params.postId, 10);
  const { body } = req.body;
  if (isNaN(postId) || !body || typeof body !== 'string') {
    res.status(400).json({ error: 'Bad Request', message: 'Post ID and body are required' });
    return;
  }
  const db = getDb();
  const post = db.prepare('SELECT post_id FROM posts WHERE post_id = ?').get(postId);
  if (!post) {
    res.status(404).json({ error: 'Not Found', message: 'Post not found' });
    return;
  }
  const now = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?, ?, ?, ?)'
  ).run(postId, user.user_id, body.trim().slice(0, 2000), now);
  const commentId = result.lastInsertRowid;
  broadcast('posts:changed');
  const row = db.prepare(`
    SELECT c.comment_id, c.post_id, c.author_id, c.body, c.created_at, c.edited_at, u.display_name as author_name
    FROM comments c JOIN users u ON u.user_id = c.author_id WHERE c.comment_id = ?
  `).get(commentId) as Record<string, unknown>;
  res.status(201).json(row);
});

postsRouter.put('/:postId/comments/:commentId', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const postId = parseInt(req.params.postId, 10);
  const commentId = parseInt(req.params.commentId, 10);
  const { body } = req.body;
  if (isNaN(postId) || isNaN(commentId) || !body || typeof body !== 'string') {
    return res.status(400).json({ error: 'Bad Request', message: 'Post ID, comment ID and body are required' });
  }
  const db = getDb();
  const comment = db.prepare('SELECT comment_id, author_id FROM comments WHERE comment_id = ? AND post_id = ?').get(commentId, postId) as { comment_id: number; author_id: number } | undefined;
  if (!comment) {
    return res.status(404).json({ error: 'Not Found', message: 'Comment not found' });
  }
  if (comment.author_id !== user.user_id && !user.roleList.includes('administrator')) {
    return res.status(403).json({ error: 'Forbidden', message: 'Only the comment author or admin can edit' });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE comments SET body = ?, edited_at = ? WHERE comment_id = ?').run(body.trim().slice(0, 2000), now, commentId);
  broadcast('posts:changed');
  const row = db.prepare(`
    SELECT c.comment_id, c.post_id, c.author_id, c.body, c.created_at, c.edited_at, u.display_name as author_name
    FROM comments c JOIN users u ON u.user_id = c.author_id WHERE c.comment_id = ?
  `).get(commentId) as Record<string, unknown>;
  res.status(200).json(row);
});

postsRouter.delete('/:postId/comments/:commentId', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const postId = parseInt(req.params.postId, 10);
  const commentId = parseInt(req.params.commentId, 10);
  if (isNaN(postId) || isNaN(commentId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid IDs' });
  }
  const db = getDb();
  const comment = db.prepare('SELECT comment_id, author_id FROM comments WHERE comment_id = ? AND post_id = ?').get(commentId, postId) as { comment_id: number; author_id: number } | undefined;
  if (!comment) {
    return res.status(404).json({ error: 'Not Found', message: 'Comment not found' });
  }
  if (comment.author_id !== user.user_id && !user.roleList.includes('administrator')) {
    return res.status(403).json({ error: 'Forbidden', message: 'Only the comment author or admin can delete' });
  }
  db.prepare('DELETE FROM comments WHERE comment_id = ?').run(commentId);
  broadcast('posts:changed');
  res.status(204).send();
});

postsRouter.post('/:postId/reactions', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const postId = parseInt(req.params.postId, 10);
  const { type } = req.body;
  if (isNaN(postId) || !type || !VALID_REACTIONS.includes(type)) {
    res.status(400).json({ error: 'Bad Request', message: 'Valid post ID and reaction type are required' });
    return;
  }
  const db = getDb();
  const post = db.prepare('SELECT post_id FROM posts WHERE post_id = ?').get(postId);
  if (!post) {
    res.status(404).json({ error: 'Not Found', message: 'Post not found' });
    return;
  }
  const existing = db.prepare('SELECT reaction_id FROM reactions WHERE post_id = ? AND author_id = ?')
    .get(postId, user.user_id) as { reaction_id: number } | undefined;
  const now = new Date().toISOString();
  if (existing) {
    db.prepare('UPDATE reactions SET type = ?, created_at = ? WHERE reaction_id = ?').run(type, now, existing.reaction_id);
  } else {
    db.prepare('INSERT INTO reactions (post_id, author_id, type, created_at) VALUES (?, ?, ?, ?)')
      .run(postId, user.user_id, type, now);
  }
  broadcast('posts:changed');
  const row = db.prepare(`
    SELECT r.*, u.display_name as author_name FROM reactions r
    JOIN users u ON u.user_id = r.author_id
    WHERE r.post_id = ? AND r.author_id = ?
  `).get(postId, user.user_id) as Record<string, unknown>;
  res.status(200).json(row);
});

postsRouter.delete('/:postId/reactions/:reactionId', requireAuth, requireRole('administrator'), (req: Request & { user?: SessionUser | null }, res: Response) => {
  const postId = parseInt(req.params.postId, 10);
  const reactionId = parseInt(req.params.reactionId, 10);
  if (isNaN(postId) || isNaN(reactionId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid IDs' });
  }
  const db = getDb();
  const reaction = db.prepare('SELECT reaction_id FROM reactions WHERE reaction_id = ? AND post_id = ?').get(reactionId, postId);
  if (!reaction) {
    return res.status(404).json({ error: 'Not Found', message: 'Reaction not found' });
  }
  db.prepare('DELETE FROM reactions WHERE reaction_id = ?').run(reactionId);
  broadcast('posts:changed');
  res.status(204).send();
});
