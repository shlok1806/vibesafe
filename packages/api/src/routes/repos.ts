import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getReposForUser } from '../db/queries/repos';
import { getScansForRepo } from '../db/queries/scans';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const repos = await getReposForUser(user.id);
    return res.json({ repos });
  } catch (err) {
    console.error('Get repos error:', err);
    return res.status(500).json({ error: 'Failed to fetch repos.' });
  }
});

router.get('/:repoId/scans', requireAuth, async (req: Request, res: Response) => {
  const user   = (req as any).user;
  const limit  = Math.min(parseInt(req.query.limit as string || '20', 10), 100);

  try {
    const repos = await getReposForUser(user.id);
    const repo  = repos.find(r => r.id === req.params.repoId);
    if (!repo) return res.status(404).json({ error: 'Repo not found.' });

    const scans = await getScansForRepo(repo.id, limit);
    return res.json({ scans });
  } catch (err) {
    console.error('Get repo scans error:', err);
    return res.status(500).json({ error: 'Failed to fetch scans.' });
  }
});

export default router;
