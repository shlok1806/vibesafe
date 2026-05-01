import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../lib/jwt';
import { getUserById } from '../db/queries/users';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.vibesafe_token
    ?? req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const payload = verifyJwt(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  const user = await getUserById(payload.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found.' });
    return;
  }

  (req as any).user = user;
  next();
}
