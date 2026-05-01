import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateApiKey } from '../middleware/apiKey';
import { rateLimit } from '../middleware/rateLimit';
import { checkUsageLimit, recordScan } from '../services/usage';
import { analyzeDiff } from '../services/analyzer';
import { saveScan } from '../db/queries/scans';
import { DEFAULT_CONFIG } from '@vibesafe/shared';

const router = Router();

const FileSchema = z.object({
  filename:  z.string(),
  status:    z.enum(['added', 'modified', 'renamed', 'removed']),
  additions: z.number(),
  patch:     z.string().optional(),
  raw_url:   z.string().optional(),
});

const ConfigSchema = z.object({
  severity_threshold: z.enum(['critical', 'warning', 'info']).default('warning'),
  fail_on_critical:   z.boolean().default(false),
  max_files:          z.number().max(50).default(20),
  ignore_paths:       z.array(z.string()).default([]),
  skip_categories:    z.array(z.string()).default([]),
  custom_rules:       z.array(z.any()).default([]),
});

const AnalyzeSchema = z.object({
  files:          z.array(FileSchema),
  pr_title:       z.string().optional(),
  pr_url:         z.string().optional(),
  pr_number:      z.number().optional(),
  head_sha:       z.string().optional(),
  repo_full_name: z.string().optional(),
  github_repo_id: z.number().optional(),
  is_private:     z.boolean().optional(),
  config:         ConfigSchema.default({}),
});

router.post('/', authenticateApiKey, rateLimit, async (req: Request, res: Response) => {
  const parsed = AnalyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const {
    files, pr_title, pr_url, pr_number, head_sha,
    config, repo_full_name, github_repo_id, is_private,
  } = parsed.data;
  const user = (req as any).user;

  const allowed = await checkUsageLimit(user.id);
  if (!allowed) {
    return res.status(429).json({
      error: 'Monthly scan limit reached. Upgrade to Pro for unlimited scans.',
    });
  }

  try {
    const analysisConfig = { ...DEFAULT_CONFIG, ...config } as any;
    const result = await analyzeDiff(files as any, pr_title ?? '', analysisConfig);

    await recordScan(user.id);

    let scanId: string | undefined;
    if (repo_full_name && pr_number !== undefined) {
      scanId = await saveScan(user.id, {
        repo_full_name,
        pr_number,
        pr_title,
        pr_url,
        head_sha,
        github_repo_id,
        is_private,
        score:          result.score,
        issues:         result.issues,
        summary:        result.summary,
        files_analyzed: result.files_analyzed,
        tokens_used:    result.tokens_used,
        analysis_ms:    result.analysis_ms,
      });
    }

    return res.json({ result, scan_id: scanId });
  } catch (err) {
    console.error('Analysis error:', err);
    return res.status(500).json({ error: 'Analysis failed.' });
  }
});

export default router;
