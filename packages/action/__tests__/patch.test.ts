import { parseAddedLineNumbers, buildLineNumberMap, validateLineNumber } from '@vibesafe/shared';
import type { ChangedFile } from '@vibesafe/shared';

// Minimal unified diff fixture:
// - original file has lines 1-10
// - hunk replaces lines 3-5 with two new lines, then adds a line after line 8
const SAMPLE_PATCH = [
  '@@ -1,10 +1,10 @@',
  ' line 1',         // context → new line 1
  ' line 2',         // context → new line 2
  '-old line 3',     // removed (old only)
  '+new line 3',     // added   → new line 3  ✓
  '+new line 4',     // added   → new line 4  ✓
  ' line 5',         // context → new line 5
  ' line 6',         // context → new line 6
  ' line 7',         // context → new line 7
  '-old line 8',     // removed
  '+new line 8',     // added   → new line 8  ✓
  ' line 9',         // context → new line 9
].join('\n');

describe('parseAddedLineNumbers', () => {
  it('returns the correct new-file line numbers for added lines', () => {
    const added = parseAddedLineNumbers(SAMPLE_PATCH);
    expect(added.has(3)).toBe(true);
    expect(added.has(4)).toBe(true);
    expect(added.has(8)).toBe(true);
  });

  it('does not include context or removed lines', () => {
    const added = parseAddedLineNumbers(SAMPLE_PATCH);
    expect(added.has(1)).toBe(false);
    expect(added.has(2)).toBe(false);
    expect(added.has(5)).toBe(false);
    expect(added.has(9)).toBe(false);
  });

  it('handles multiple hunks', () => {
    const multiHunk = [
      '@@ -1,3 +1,4 @@',
      ' ctx',
      '+added A',   // new line 2
      ' ctx',
      ' ctx',
      '@@ -10,3 +11,4 @@',
      ' ctx',
      '+added B',   // new line 12
      ' ctx',
      ' ctx',
    ].join('\n');

    const added = parseAddedLineNumbers(multiHunk);
    expect(added.has(2)).toBe(true);
    expect(added.has(12)).toBe(true);
    expect(added.has(11)).toBe(false);
    expect(added.has(13)).toBe(false);
  });

  it('returns empty set for empty patch', () => {
    expect(parseAddedLineNumbers('')).toEqual(new Set());
  });

  it('handles "no newline" markers without crashing', () => {
    const patch = [
      '@@ -1,1 +1,2 @@',
      ' existing',
      '+added',
      '\\ No newline at end of file',
    ].join('\n');
    const added = parseAddedLineNumbers(patch);
    expect(added.has(2)).toBe(true);
  });
});

describe('buildLineNumberMap', () => {
  it('maps each filename to its added-line set', () => {
    const files: ChangedFile[] = [
      { filename: 'src/a.ts', status: 'modified', additions: 2, patch: SAMPLE_PATCH },
      { filename: 'src/b.ts', status: 'added',    additions: 0 },
    ];
    const map = buildLineNumberMap(files);
    expect(map.get('src/a.ts')?.has(3)).toBe(true);
    expect(map.get('src/b.ts')).toEqual(new Set());
  });
});

describe('validateLineNumber', () => {
  const map = new Map([
    ['src/a.ts', new Set([3, 4, 8])],
  ]);

  it('returns the line if it is a valid added line', () => {
    expect(validateLineNumber(3, 'src/a.ts', map)).toBe(3);
  });

  it('returns undefined if line is not in the added set', () => {
    expect(validateLineNumber(1, 'src/a.ts', map)).toBeUndefined();
    expect(validateLineNumber(99, 'src/a.ts', map)).toBeUndefined();
  });

  it('returns undefined if line is undefined', () => {
    expect(validateLineNumber(undefined, 'src/a.ts', map)).toBeUndefined();
  });

  it('returns undefined for an unknown file', () => {
    expect(validateLineNumber(3, 'src/unknown.ts', map)).toBeUndefined();
  });
});
