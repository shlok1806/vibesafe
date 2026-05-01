import * as core from '@actions/core';
import * as github from '@actions/github';
import * as yaml from 'js-yaml';
import { AnalysisConfig, RepoConfig, DEFAULT_CONFIG } from '@vibesafe/shared';

export interface ActionConfig {
  githubToken: string;
  anthropicApiKey?: string;
  vibesafeToken?: string;
  inlineComments: boolean;
  analysis: AnalysisConfig;
}

export async function loadConfig(): Promise<ActionConfig> {
  const githubToken   = core.getInput('github-token', { required: true });
  const anthropicKey  = core.getInput('anthropic-api-key') || undefined;
  const vibesafeToken = core.getInput('vibesafe-token') || undefined;
  const inlineComments = core.getInput('inline-comments') === 'true';

  if (!anthropicKey && !vibesafeToken) {
    throw new Error('Either anthropic-api-key or vibesafe-token must be provided.');
  }

  const baseConfig: AnalysisConfig = {
    ...DEFAULT_CONFIG,
    severity_threshold: (core.getInput('severity-threshold') || 'warning') as AnalysisConfig['severity_threshold'],
    fail_on_critical:   core.getInput('fail-on-critical') === 'true',
    max_files:          parseInt(core.getInput('max-files') || '20', 10),
  };

  const repoConfig = await fetchRepoConfig(githubToken);
  const analysis = mergeConfigs(baseConfig, repoConfig);

  return { githubToken, anthropicApiKey: anthropicKey, vibesafeToken, inlineComments, analysis };
}

async function fetchRepoConfig(token: string): Promise<RepoConfig | null> {
  try {
    const octokit = github.getOctokit(token);
    const context = github.context;
    const { data } = await octokit.rest.repos.getContent({
      owner: context.repo.owner,
      repo:  context.repo.repo,
      path:  '.vibesafe.yml',
    });
    if ('content' in data) {
      const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
      return yaml.load(decoded) as RepoConfig;
    }
  } catch {
    // .vibesafe.yml doesn't exist — use defaults
  }
  return null;
}

function mergeConfigs(base: AnalysisConfig, repo: RepoConfig | null): AnalysisConfig {
  if (!repo) return base;
  return {
    severity_threshold: repo.severity_threshold ?? base.severity_threshold,
    fail_on_critical:   repo.fail_on_critical   ?? base.fail_on_critical,
    max_files:          repo.max_files           ?? base.max_files,
    ignore_paths:       [...base.ignore_paths, ...(repo.ignore_paths ?? [])],
    skip_categories:    repo.skip_categories     ?? base.skip_categories,
    custom_rules:       repo.custom_rules        ?? base.custom_rules,
  };
}
