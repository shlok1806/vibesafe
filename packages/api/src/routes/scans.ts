import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getScansForUser, getScanById } from '../db/queries/scans';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user  = (req as any).user;
  const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);

  try {
    const scans = await getScansForUser(user.id, limit);
    return res.json({ scans });
  } catch (err) {
    console.error('Get scans error:', err);
    return res.status(500).json({ error: 'Failed to fetch scans.' });
  }
});

router.get('/:scanId', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const scan = await getScanById(req.params.scanId, user.id);
    if (!scan) return res.status(404).json({ error: 'Scan not found.' });
    return res.json({ scan });
  } catch (err) {
    console.error('Get scan error:', err);
    return res.status(500).json({ error: 'Failed to fetch scan.' });
  }
});

export default router;
