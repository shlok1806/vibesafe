import * as github from '@actions/github';
import { ChangedFile, Issue } from '@vibesafe/shared';
import { BINARY_EXTENSIONS } from '@vibesafe/shared';

const COMMENT_MARKER = '<!-- vibesafe-review -->';

export async function getChangedFiles(token: string, context: typeof github.context): Promise<ChangedFile[]> {
  const octokit  = github.getOctokit(token);
  const prNumber = context.payload.pull_request!.number;

  const { data } = await octokit.rest.pulls.listFiles({
    owner:       context.repo.owner,
    repo:        context.repo.repo,
    pull_number: prNumber,
    per_page:    100,
  });

  return data
    .filter(f => f.status !== 'removed')
    .filter(f => {
      const ext = f.filename.split('.').pop()?.toLowerCase() ?? '';
      return !BINARY_EXTENSIONS.has(ext);
    })
    .filter(f => f.patch && f.patch.length > 0)
    .map(f => ({
      filename:  f.filename,
      status:    f.status as ChangedFile['status'],
      additions: f.additions,
      patch:     f.patch,
      raw_url:   f.raw_url,
    }));
}

export async function postComment(
  token: string,
  context: typeof github.context,
  prNumber: number,
  body: string,
): Promise<void> {
  const octokit = github.getOctokit(token);
  const { owner, repo } = context.repo;

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });
  const existing = comments.find(c => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
  }
}

export async function postInlineComments(
  token: string,
  context: typeof github.context,
  prNumber: number,
  issues: Issue[],
): Promise<void> {
  const octokit = github.getOctokit(token);
  const { owner, repo } = context.repo;

  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
  const commitId = pr.head.sha;

  const inlineIssues = issues.filter(i => i.line !== undefined);
  if (inlineIssues.length === 0) return;

  const comments = inlineIssues.map(issue => ({
    path:  issue.file,
    line:  issue.line!,
    side:  'RIGHT' as const,
    body:  buildInlineCommentBody(issue),
  }));

  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    commit_id:   commitId,
    event:       'COMMENT',
    comments,
  });
}

function buildInlineCommentBody(issue: Issue): string {
  const emoji = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
  return [
    `${emoji} **VibeSafe · ${issue.category}**`,
    '',
    issue.description,
    '',
    `**Fix:** ${issue.fix}`,
  ].join('\n');
}
