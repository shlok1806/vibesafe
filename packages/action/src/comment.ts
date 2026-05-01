import { AnalysisResult, Issue, Severity } from '@vibesafe/shared';
import { scoreBar, scoreLabel } from '@vibesafe/shared';
import { ISSUE_CATEGORIES } from '@vibesafe/shared';

export const COMMENT_MARKER = '<!-- vibesafe-review -->';

const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: '🔴',
  warning:  '🟡',
  info:     '🔵',
};

export function buildComment(result: AnalysisResult, filesAnalyzed: number, prTitle: string): string {
  const { score, issues, summary } = result;
  const criticals = issues.filter(i => i.severity === 'critical');
  const warnings  = issues.filter(i => i.severity === 'warning');
  const infos     = issues.filter(i => i.severity === 'info');

  const statsStr = [
    criticals.length > 0 ? ` 🔴 ${criticals.length} critical` : '',
    warnings.length  > 0 ? ` 🟡 ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}` : '',
    infos.length     > 0 ? ` 🔵 ${infos.length} info` : '',
    issues.length    === 0 ? ' ✅ No issues found' : '',
  ].join('');

  const lines: string[] = [
    COMMENT_MARKER,
    '## 🛡️ VibeSafe',
    '',
    `*${summary}*`,
    '',
    `**Score:** \`${scoreBar(score)}\` ${score}/100 &nbsp; ${scoreLabel(score)}`,
    '',
    `📁 ${filesAnalyzed} file${filesAnalyzed !== 1 ? 's' : ''} &nbsp;|&nbsp;${statsStr}`,
    '',
  ];

  const groups: Array<[Severity, Issue[]]> = [
    ['critical', criticals],
    ['warning',  warnings],
    ['info',     infos],
  ];

  for (const [severity, group] of groups) {
    if (group.length === 0) continue;
    const emoji = SEVERITY_EMOJI[severity];
    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    lines.push(`### ${emoji} ${label} Issues`);
    lines.push('');
    for (const issue of group) {
      const categoryLabel = ISSUE_CATEGORIES[issue.category]?.label ?? issue.category;
      const location = `${issue.file}${issue.line ? `:${issue.line}` : ''}`;
      lines.push('<details>');
      lines.push(`<summary>${emoji} <strong>${issue.title}</strong> · \`${categoryLabel}\` · \`${location}\`</summary>`);
      lines.push('');
      lines.push("**What's wrong:**");
      lines.push(issue.description);
      if (issue.problematic_code) {
        lines.push('');
        lines.push('**Problematic code:**');
        lines.push('```');
        lines.push(issue.problematic_code);
        lines.push('```');
      }
      lines.push('');
      lines.push(`**Fix:** ${issue.fix}`);
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('*[VibeSafe](https://vibesafe.dev) · [Report false positive](https://github.com/shlok1806/vibesafe/issues)*');

  return lines.join('\n');
}
