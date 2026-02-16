import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { requireAuth, requireRole } from '../auth';
import { broadcast } from '../live';
import type { SessionUser } from '../types';
import type { ReportStatus } from '../types';

export const reportsRouter = Router();

const VALID_STATUS: ReportStatus[] = ['open', 'in_review', 'resolved'];
const VALID_ENTITY_TYPES = ['post', 'comment'];

reportsRouter.post('/', requireAuth, (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const { entityType, entityId, reason, details } = req.body;
  if (!entityType || !VALID_ENTITY_TYPES.includes(entityType) || entityId == null) {
    return res.status(400).json({ error: 'Bad Request', message: 'entityType (post|comment) and entityId are required' });
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'reason is required' });
  }
  const db = getDb();
  const eId = parseInt(String(entityId), 10);
  if (entityType === 'post') {
    const post = db.prepare('SELECT post_id FROM posts WHERE post_id = ?').get(eId);
    if (!post) return res.status(404).json({ error: 'Not Found', message: 'Post not found' });
  } else {
    const comment = db.prepare('SELECT comment_id FROM comments WHERE comment_id = ?').get(eId);
    if (!comment) return res.status(404).json({ error: 'Not Found', message: 'Comment not found' });
  }
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO moderation_reports (reporter_id, entity_type, entity_id, reason, details, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
  `).run(user.user_id, entityType, eId, reason.trim().slice(0, 500), (details && typeof details === 'string' ? details.trim().slice(0, 2000) : '') || '', now, now);
  const reportId = result.lastInsertRowid;
  const row = db.prepare(`
    SELECT r.*, u.display_name as reporter_name
    FROM moderation_reports r
    JOIN users u ON u.user_id = r.reporter_id
    WHERE r.report_id = ?
  `).get(reportId) as Record<string, unknown>;
  broadcast('reports:changed');
  res.status(201).json(row);
});

reportsRouter.get('/', requireAuth, requireRole('administrator'), (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT r.*, u.display_name as reporter_name
    FROM moderation_reports r
    JOIN users u ON u.user_id = r.reporter_id
    ORDER BY r.created_at DESC
  `).all() as Record<string, unknown>[];
  res.status(200).json(rows);
});

reportsRouter.get('/:reportId', requireAuth, requireRole('administrator'), (req: Request, res: Response) => {
  const reportId = parseInt(req.params.reportId, 10);
  if (isNaN(reportId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid report ID' });
  }
  const db = getDb();
  const row = db.prepare(`
    SELECT r.*, u.display_name as reporter_name
    FROM moderation_reports r
    JOIN users u ON u.user_id = r.reporter_id
    WHERE r.report_id = ?
  `).get(reportId) as Record<string, unknown> | undefined;
  if (!row) {
    return res.status(404).json({ error: 'Not Found', message: 'Report not found' });
  }
  const audit = db.prepare(`
    SELECT a.*, u.display_name as actor_name
    FROM report_audit a
    LEFT JOIN users u ON u.user_id = a.actor_id
    WHERE a.report_id = ?
    ORDER BY a.created_at ASC
  `).all(reportId) as Record<string, unknown>[];
  res.status(200).json({ ...row, audit });
});

reportsRouter.patch('/:reportId/status', requireAuth, requireRole('administrator'), (req: Request & { user?: SessionUser | null }, res: Response) => {
  const user = req.user!;
  const reportId = parseInt(req.params.reportId, 10);
  const { status, action, details } = req.body;
  if (isNaN(reportId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid report ID' });
  }
  if (!status || !VALID_STATUS.includes(status)) {
    return res.status(400).json({ error: 'Bad Request', message: 'status must be open, in_review, or resolved' });
  }
  const db = getDb();
  const report = db.prepare('SELECT report_id FROM moderation_reports WHERE report_id = ?').get(reportId);
  if (!report) {
    return res.status(404).json({ error: 'Not Found', message: 'Report not found' });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE moderation_reports SET status = ?, updated_at = ? WHERE report_id = ?').run(status, now, reportId);
  const actionText = action && typeof action === 'string' ? action.trim() : `Status updated to ${status}`;
  db.prepare('INSERT INTO report_audit (report_id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(reportId, user.user_id, actionText, (details && typeof details === 'string' ? details.trim() : '') || '', now);
  broadcast('reports:changed');
  const row = db.prepare(`
    SELECT r.*, u.display_name as reporter_name
    FROM moderation_reports r
    JOIN users u ON u.user_id = r.reporter_id
    WHERE r.report_id = ?
  `).get(reportId) as Record<string, unknown>;
  const audit = db.prepare(`
    SELECT a.*, u.display_name as actor_name
    FROM report_audit a
    LEFT JOIN users u ON u.user_id = a.actor_id
    WHERE a.report_id = ?
    ORDER BY a.created_at ASC
  `).all(reportId) as Record<string, unknown>[];
  res.status(200).json({ ...row, audit });
});
