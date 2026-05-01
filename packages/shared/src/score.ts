import type { Issue } from './types';
import { SCORE_THRESHOLDS } from './constants';

export function calculateScore(issues: Issue[]): number {
  const criticals = issues.filter(i => i.severity === 'critical').length;
  const warnings  = issues.filter(i => i.severity === 'warning').length;
  const infos     = issues.filter(i => i.severity === 'info').length;

  const penalty =
    Math.min(criticals * SCORE_THRESHOLDS.CRITICAL_PENALTY, 75) +
    Math.min(warnings  * SCORE_THRESHOLDS.WARNING_PENALTY,  20) +
    Math.min(infos     * SCORE_THRESHOLDS.INFO_PENALTY,      5);

  return Math.max(0, 100 - penalty);
}

export function scoreLabel(score: number): string {
  if (score >= 90) return '✅ Clean';
  if (score >= 70) return '🟡 Minor Issues';
  if (score >= 40) return '🔴 Needs Review';
  return '🚨 Critical Issues';
}

export function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
