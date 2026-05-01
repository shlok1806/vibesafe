import { Request, Response, NextFunction } from 'express';
import { db } from '../db/client';
import { hashToken } from '../lib/crypto';
import { getUserById } from '../db/queries/users';

export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing API token.' });
    return;
  }

  const raw = authHeader.slice(7);
  const hash = hashToken(raw);

  const { rows } = await db.query<{ user_id: string; id: string }>(
    'SELECT id, user_id FROM api_tokens WHERE token_hash = $1',
    [hash],
  );

  if (rows.length === 0) {
    res.status(401).json({ error: 'Invalid API token.' });
    return;
  }

  // Update last_used_at in background — don't block the request
  db.query('UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1', [rows[0].id]).catch(() => {});

  const user = await getUserById(rows[0].user_id);
  if (!user) {
    res.status(401).json({ error: 'User not found.' });
    return;
  }

  (req as any).user = user;
  next();
}
