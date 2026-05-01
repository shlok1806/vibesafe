import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';

const WINDOW_MS = 60_000;    // 1 minute sliding window
const FREE_LIMIT = 20;       // requests per window for free tier
const PRO_LIMIT  = 200;

export async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = (req as any).user;
  if (!user) { next(); return; }

  const limit = user.plan === 'pro' ? PRO_LIMIT : FREE_LIMIT;
  const key   = `rl:${user.id}`;
  const now   = Date.now();
  const windowStart = now - WINDOW_MS;

  const pipe = redis.pipeline();
  pipe.zremrangebyscore(key, 0, windowStart);
  pipe.zadd(key, now, `${now}-${Math.random()}`);
  pipe.zcard(key);
  pipe.expire(key, 120);
  const results = await pipe.exec();

  const count = (results?.[2]?.[1] as number) ?? 0;

  res.setHeader('X-RateLimit-Limit',     limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));

  if (count > limit) {
    res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
    return;
  }

  next();
}
