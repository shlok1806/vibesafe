import { ChangedFile } from './types';

// Returns the set of new-file line numbers for added lines in a unified diff.
// GitHub only accepts inline comments on lines that appear as "+" in the diff,
// so we use this to validate before posting a review.
export function parseAddedLineNumbers(patch: string): Set<number> {
  const added = new Set<number>();
  let newLine = 0;

  for (const line of patch.split('\n')) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = parseInt(hunk[1], 10) - 1;
      continue;
    }

    if (line.startsWith('\\')) continue; // "\ No newline at end of file"

    if (line.startsWith('-')) {
      continue; // removed — only old file pointer advances
    }

    if (line.startsWith('+')) {
      newLine++;
      added.add(newLine);
    } else {
      newLine++; // context line
    }
  }

  return added;
}

// Builds a filename → valid added-line-numbers map for a set of changed files.
export function buildLineNumberMap(files: ChangedFile[]): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const file of files) {
    map.set(file.filename, file.patch ? parseAddedLineNumbers(file.patch) : new Set());
  }
  return map;
}

// Returns the line if it's a valid added line for that file, otherwise undefined.
// Prevents us from trying to post inline comments on lines GitHub won't accept.
export function validateLineNumber(
  line: number | undefined,
  filename: string,
  lineMap: Map<string, Set<number>>,
): number | undefined {
  if (line === undefined) return undefined;
  const valid = lineMap.get(filename);
  return valid?.has(line) ? line : undefined;
}
