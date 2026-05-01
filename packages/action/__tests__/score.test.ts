import { calculateScore, scoreLabel, scoreBar } from '@vibesafe/shared';
import type { Issue } from '@vibesafe/shared';

function makeIssue(severity: Issue['severity']): Issue {
  return {
    id: 'test-id',
    category: 'SQL_INJECTION',
    severity,
    file: 'src/db.ts',
    title: 'Test issue',
    description: 'desc',
    fix: 'fix it',
  };
}

describe('calculateScore', () => {
  it('returns 100 for no issues', () => {
    expect(calculateScore([])).toBe(100);
  });

  it('deducts 25 per critical (capped at 75)', () => {
    expect(calculateScore([makeIssue('critical')])).toBe(75);
    expect(calculateScore([makeIssue('critical'), makeIssue('critical')])).toBe(50);
    // 4 criticals = 100 penalty but capped at 75 → score 25
    const fourCriticals = Array(4).fill(makeIssue('critical'));
    expect(calculateScore(fourCriticals)).toBe(25);
  });

  it('deducts 8 per warning (capped at 20 total warning penalty)', () => {
    expect(calculateScore([makeIssue('warning')])).toBe(92);
    expect(calculateScore([makeIssue('warning'), makeIssue('warning')])).toBe(84);
    // 3 warnings = 24 but capped at 20 → score 80
    const threeWarnings = Array(3).fill(makeIssue('warning'));
    expect(calculateScore(threeWarnings)).toBe(80);
  });

  it('deducts 2 per info (capped at 5 total info penalty)', () => {
    expect(calculateScore([makeIssue('info')])).toBe(98);
    // 3 infos = 6 but capped at 5 → score 95
    const threeInfos = Array(3).fill(makeIssue('info'));
    expect(calculateScore(threeInfos)).toBe(95);
  });

  it('never goes below 0', () => {
    const manyIssues = [
      ...Array(4).fill(makeIssue('critical')),
      ...Array(3).fill(makeIssue('warning')),
      ...Array(3).fill(makeIssue('info')),
    ];
    expect(calculateScore(manyIssues)).toBeGreaterThanOrEqual(0);
  });
});

describe('scoreLabel', () => {
  it('labels correctly by threshold', () => {
    expect(scoreLabel(100)).toBe('✅ Clean');
    expect(scoreLabel(90)).toBe('✅ Clean');
    expect(scoreLabel(89)).toBe('🟡 Minor Issues');
    expect(scoreLabel(70)).toBe('🟡 Minor Issues');
    expect(scoreLabel(69)).toBe('🔴 Needs Review');
    expect(scoreLabel(40)).toBe('🔴 Needs Review');
    expect(scoreLabel(39)).toBe('🚨 Critical Issues');
    expect(scoreLabel(0)).toBe('🚨 Critical Issues');
  });
});

describe('scoreBar', () => {
  it('produces 10-character bar', () => {
    const bar = scoreBar(75);
    expect(bar.length).toBe(10);
  });

  it('fills correctly at 100 and 0', () => {
    expect(scoreBar(100)).toBe('██████████');
    expect(scoreBar(0)).toBe('░░░░░░░░░░');
  });

  it('rounds to nearest block', () => {
    // 75 → 8 filled
    expect(scoreBar(75)).toBe('████████░░');
  });
});
