import { db } from '../client';
import { Repo } from '@vibesafe/shared';

export interface RepoWithLastScan extends Repo {
  last_scan_score?: number;
  last_scan_at?: Date;
}

export async function upsertRepo(params: {
  user_id: string;
  github_repo_id: number;
  full_name: string;
  is_private: boolean;
}): Promise<Repo> {
  const { rows } = await db.query<Repo>(
    `INSERT INTO repos (user_id, github_repo_id, full_name, is_private)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, github_repo_id) DO UPDATE SET
       full_name  = EXCLUDED.full_name,
       is_private = EXCLUDED.is_private
     RETURNING *`,
    [params.user_id, params.github_repo_id, params.full_name, params.is_private],
  );
  return rows[0];
}

export async function getRepoByFullName(userId: string, fullName: string): Promise<Repo | null> {
  const { rows } = await db.query<Repo>(
    'SELECT * FROM repos WHERE user_id = $1 AND full_name = $2',
    [userId, fullName],
  );
  return rows[0] ?? null;
}

export async function getReposForUser(userId: string): Promise<RepoWithLastScan[]> {
  const { rows } = await db.query<RepoWithLastScan>(
    `SELECT r.*,
            s.score       AS last_scan_score,
            s.created_at  AS last_scan_at
     FROM repos r
     LEFT JOIN LATERAL (
       SELECT score, created_at
       FROM scans
       WHERE repo_id = r.id
       ORDER BY created_at DESC
       LIMIT 1
     ) s ON true
     WHERE r.user_id = $1
     ORDER BY r.last_scanned_at DESC NULLS LAST`,
    [userId],
  );
  return rows;
}

export async function touchRepo(repoId: string): Promise<void> {
  await db.query(
    'UPDATE repos SET last_scanned_at = NOW(), total_scans = total_scans + 1 WHERE id = $1',
    [repoId],
  );
}
