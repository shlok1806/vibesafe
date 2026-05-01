import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadConfig } from './config';
import { getChangedFiles, postComment, postInlineComments } from './github';
import { analyzeDiff } from './analyzer';
import { buildComment } from './comment';
import { filterFiles } from './filter';

async function run(): Promise<void> {
  try {
    const config = await loadConfig();

    const context = github.context;
    if (!context.payload.pull_request) {
      core.warning('VibeSafe only runs on pull_request events. Skipping.');
      return;
    }
    const prNumber = context.payload.pull_request.number;
    const prTitle  = context.payload.pull_request.title as string;

    const allFiles = await getChangedFiles(config.githubToken, context);
    const filesToAnalyze = filterFiles(allFiles, config.analysis);

    core.info(`Analyzing ${filesToAnalyze.length} files...`);

    const result = await analyzeDiff(filesToAnalyze, prTitle, config);

    const commentBody = buildComment(result, filesToAnalyze.length, prTitle);
    await postComment(config.githubToken, context, prNumber, commentBody);

    if (config.inlineComments && result.issues.some(i => i.line)) {
      await postInlineComments(config.githubToken, context, prNumber, result.issues);
    }

    core.setOutput('score',          String(result.score));
    core.setOutput('critical-count', String(result.issues.filter(i => i.severity === 'critical').length));
    core.setOutput('warning-count',  String(result.issues.filter(i => i.severity === 'warning').length));
    core.setOutput('issues-found',   String(result.issues.length > 0));

    const criticals = result.issues.filter(i => i.severity === 'critical');
    if (config.analysis.fail_on_critical && criticals.length > 0) {
      core.setFailed(`VibeSafe found ${criticals.length} critical issue(s). Merge blocked.`);
    }

  } catch (error) {
    core.setFailed(`VibeSafe failed: ${(error as Error).message}`);
  }
}

run();
