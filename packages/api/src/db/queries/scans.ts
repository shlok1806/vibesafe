import { db } from '../client';
import { Scan } from '@vibesafe/shared';
import { upsertRepo, touchRepo } from './repos';

interface SaveScanParams {
  repo_full_name: string;
  pr_number: number;
  pr_title?: string;
  pr_url?: string;
  head_sha?: string;
  score: number;
  issues: Scan['issues'];
  summary: string;
  files_analyzed: number;
  tokens_used: number;
  analysis_ms: number;
  is_private?: boolean;
  github_repo_id?: number;
}

export async function saveScan(userId: string, params: SaveScanParams): Promise<string> {
  const repo = await upsertRepo({
    user_id:        userId,
    github_repo_id: params.github_repo_id ?? 0,
    full_name:      params.repo_full_name,
    is_private:     params.is_private ?? false,
  });

  const criticalCount = params.issues.filter(i => i.severity === 'critical').length;
  const warningCount  = params.issues.filter(i => i.severity === 'warning').length;
  const infoCount     = params.issues.filter(i => i.severity === 'info').length;

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO scans
       (repo_id, pr_number, pr_title, pr_url, head_sha, score,
        critical_count, warning_count, info_count, files_analyzed,
        issues, summary, tokens_used, analysis_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      repo.id, params.pr_number, params.pr_title ?? null,
      params.pr_url ?? null, params.head_sha ?? null, params.score,
      criticalCount, warningCount, infoCount, params.files_analyzed,
      JSON.stringify(params.issues), params.summary,
      params.tokens_used, params.analysis_ms,
    ],
  );

  await touchRepo(repo.id);
  return rows[0].id;
}

export async function getScanById(scanId: string, userId: string): Promise<Scan | null> {
  const { rows } = await db.query<Scan>(
    `SELECT s.* FROM scans s
     JOIN repos r ON r.id = s.repo_id
     WHERE s.id = $1 AND r.user_id = $2`,
    [scanId, userId],
  );
  return rows[0] ?? null;
}

export async function getScansForUser(userId: string, limit = 20): Promise<Scan[]> {
  const { rows } = await db.query<Scan>(
    `SELECT s.* FROM scans s
     JOIN repos r ON r.id = s.repo_id
     WHERE r.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows;
}

export async function getScansForRepo(repoId: string, limit = 20): Promise<Scan[]> {
  const { rows } = await db.query<Scan>(
    `SELECT * FROM scans WHERE repo_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [repoId, limit],
  );
  return rows;
}
