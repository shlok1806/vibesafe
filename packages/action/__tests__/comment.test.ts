import { buildComment, COMMENT_MARKER } from '../src/comment';
import type { AnalysisResult, Issue } from '@vibesafe/shared';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'abc-123',
    category: 'SQL_INJECTION',
    severity: 'critical',
    file: 'src/db.ts',
    line: 42,
    title: 'Unsafe query',
    description: 'User input directly in SQL',
    problematic_code: 'db.query(`SELECT * FROM users WHERE id = ${userId}`)',
    fix: 'Use parameterized queries',
    ...overrides,
  };
}

function makeResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    summary: 'Adds a new user endpoint',
    score: 75,
    issues: [],
    files_analyzed: 3,
    model_used: 'claude-opus-4-6',
    tokens_used: 1200,
    analysis_ms: 800,
    ...overrides,
  };
}

describe('buildComment', () => {
  it('includes the COMMENT_MARKER for update detection', () => {
    const body = buildComment(makeResult(), 3, 'My PR');
    expect(body).toContain(COMMENT_MARKER);
  });

  it('includes score and summary', () => {
    const result = makeResult({ score: 75, summary: 'Adds user endpoint' });
    const body = buildComment(result, 3, 'My PR');
    expect(body).toContain('75/100');
    expect(body).toContain('Adds user endpoint');
  });

  it('shows no-issues message when issues array is empty', () => {
    const body = buildComment(makeResult({ issues: [] }), 2, 'My PR');
    expect(body).toContain('No issues found');
  });

  it('renders critical issue as collapsible detail with code block', () => {
    const issue = makeIssue();
    const result = makeResult({ issues: [issue] });
    const body = buildComment(result, 1, 'My PR');
    expect(body).toContain('<details>');
    expect(body).toContain('Unsafe query');
    expect(body).toContain('src/db.ts:42');
    expect(body).toContain('Problematic code');
    expect(body).toContain('Use parameterized queries');
  });

  it('omits code block when problematic_code is undefined', () => {
    const issue = makeIssue({ problematic_code: undefined });
    const body = buildComment(makeResult({ issues: [issue] }), 1, 'My PR');
    expect(body).not.toContain('Problematic code');
  });

  it('groups issues by severity in order: critical → warning → info', () => {
    const issues: Issue[] = [
      makeIssue({ severity: 'info', title: 'Info issue', id: '1' }),
      makeIssue({ severity: 'warning', title: 'Warn issue', id: '2', category: 'MISSING_AUTH' }),
      makeIssue({ severity: 'critical', title: 'Crit issue', id: '3' }),
    ];
    const body = buildComment(makeResult({ issues }), 3, 'My PR');
    const criticalIdx = body.indexOf('Critical Issues');
    const warningIdx  = body.indexOf('Warning Issues');
    const infoIdx     = body.indexOf('Info Issues');
    expect(criticalIdx).toBeLessThan(warningIdx);
    expect(warningIdx).toBeLessThan(infoIdx);
  });

  it('omits severity section when no issues of that level exist', () => {
    const issue = makeIssue({ severity: 'warning', category: 'MISSING_AUTH' });
    const body = buildComment(makeResult({ issues: [issue] }), 1, 'My PR');
    expect(body).not.toContain('Critical Issues');
    expect(body).not.toContain('Info Issues');
    expect(body).toContain('Warning Issues');
  });

  it('includes file count', () => {
    const body = buildComment(makeResult(), 5, 'My PR');
    expect(body).toContain('5 files');
  });
});
