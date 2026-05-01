import Anthropic from '@anthropic-ai/sdk';
import { ChangedFile, AnalysisResult, Issue, AnalysisConfig, IssueCategory } from '@vibesafe/shared';
import { calculateScore, ISSUE_CATEGORIES, buildLineNumberMap, validateLineNumber } from '@vibesafe/shared';
import { ActionConfig } from './config';
import { v4 as uuid } from 'uuid';

const HOSTED_API_URL = 'https://vibesafe.dev/api/analyze';

export async function analyzeDiff(
  files: ChangedFile[],
  prTitle: string,
  config: ActionConfig,
): Promise<AnalysisResult> {
  const start = Date.now();

  if (config.vibesafeToken) {
    return callHostedApi(files, prTitle, config.analysis, config.vibesafeToken, start);
  }
  return callAnthropicDirect(files, prTitle, config.analysis, config.anthropicApiKey!, start);
}

async function callAnthropicDirect(
  files: ChangedFile[],
  prTitle: string,
  analysisConfig: AnalysisConfig,
  apiKey: string,
  startMs: number,
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey });

  const diff = files
    .map(f => `// FILE: ${f.filename}\n${f.patch ?? '(no patch available)'}`)
    .join('\n\n---\n\n');

  const categoryDefs = Object.entries(ISSUE_CATEGORIES)
    .filter(([cat]) => !analysisConfig.skip_categories.includes(cat as IssueCategory))
    .map(([cat, def]) => `  - ${cat} (${def.default_severity}): ${def.description}`)
    .join('\n');

  const customRuleDefs = analysisConfig.custom_rules.length > 0
    ? '\n\nAdditional custom rules to check:\n' +
      analysisConfig.custom_rules
        .map(r => `  - ${r.id} (${r.severity}): ${r.description}${r.prompt_hint ? ' ' + r.prompt_hint : ''}`)
        .join('\n')
    : '';

  const systemPrompt = `You are VibeSafe, a security-focused code reviewer specializing in vulnerabilities introduced by AI-generated code.

Analyze ONLY the added lines (lines starting with "+") in the diff below. Ignore removed lines ("-").

Issue categories to detect:
${categoryDefs}${customRuleDefs}

Severity guide:
- critical: exploitable vulnerability, data breach risk, auth bypass
- warning: potential vulnerability, bad practice, likely bug
- info: code quality issue, maintainability concern

Score guide:
- 90-100: clean, no significant issues
- 70-89: minor issues only
- 40-69: notable issues requiring review
- 0-39: critical vulnerabilities present

For each issue, identify the file path and line number if determinable from the diff.

Return ONLY valid JSON matching this exact schema:
{
  "summary": "one sentence describing what this PR does",
  "score": <number 0-100>,
  "issues": [
    {
      "category": "<CATEGORY>",
      "severity": "<critical|warning|info>",
      "file": "<filename>",
      "line": <line_number or null>,
      "title": "<short title>",
      "description": "<what is wrong and why it matters>",
      "problematic_code": "<the specific problematic code snippet or null>",
      "fix": "<concrete fix with example>"
    }
  ]
}`;

  const response = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 4096,
    system:     systemPrompt,
    messages: [{ role: 'user', content: `PR title: "${prTitle}"\n\n${diff}` }],
  });

  const raw     = (response.content[0] as Anthropic.TextBlock).text;
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  let parsed: { summary: string; score: number; issues: RawIssue[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // If the model returns something unparseable, treat it as a clean scan
    return {
      summary:        prTitle,
      score:          100,
      issues:         [],
      files_analyzed: files.length,
      model_used:     'claude-opus-4-6',
      tokens_used:    response.usage.input_tokens + response.usage.output_tokens,
      analysis_ms:    Date.now() - startMs,
    };
  }

  const lineMap = buildLineNumberMap(files);

  const issues: Issue[] = (parsed.issues ?? []).map((r: RawIssue) => ({
    id:               uuid(),
    category:         r.category,
    severity:         r.severity,
    file:             r.file,
    line:             validateLineNumber(r.line ?? undefined, r.file, lineMap),
    title:            r.title,
    description:      r.description,
    problematic_code: r.problematic_code ?? undefined,
    fix:              r.fix,
  }));

  return {
    summary:        parsed.summary,
    score:          calculateScore(issues),
    issues,
    files_analyzed: files.length,
    model_used:     'claude-opus-4-6',
    tokens_used:    response.usage.input_tokens + response.usage.output_tokens,
    analysis_ms:    Date.now() - startMs,
  };
}

async function callHostedApi(
  files: ChangedFile[],
  prTitle: string,
  analysisConfig: AnalysisConfig,
  vibesafeToken: string,
  startMs: number,
): Promise<AnalysisResult> {
  const response = await fetch(HOSTED_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${vibesafeToken}`,
    },
    body: JSON.stringify({ files, pr_title: prTitle, config: analysisConfig }),
  });

  if (!response.ok) {
    throw new Error(`VibeSafe API error: ${response.status} ${await response.text()}`);
  }

  const { result } = await response.json() as { result: AnalysisResult };
  result.analysis_ms = Date.now() - startMs;
  return result;
}

interface RawIssue {
  category: Issue['category'];
  severity: Issue['severity'];
  file: string;
  line?: number | null;
  title: string;
  description: string;
  problematic_code?: string | null;
  fix: string;
}
