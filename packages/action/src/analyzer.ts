import OpenAI from 'openai';
import { ChangedFile, AnalysisResult, Issue, AnalysisConfig, IssueCategory } from '@vibesafe/shared';
import { calculateScore, ISSUE_CATEGORIES, buildLineNumberMap, validateLineNumber } from '@vibesafe/shared';
import { ActionConfig } from './config';
import { v4 as uuid } from 'uuid';

const HOSTED_API_URL = 'https://vibesafe.dev/api/analyze';

// NVIDIA NIM exposes an OpenAI-compatible API, so the OpenAI SDK is the client.
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
const LLM_MODEL = process.env.LLM_MODEL ?? 'meta/llama-3.3-70b-instruct';

export async function analyzeDiff(
  files: ChangedFile[],
  prTitle: string,
  config: ActionConfig,
): Promise<AnalysisResult> {
  const start = Date.now();

  if (config.vibesafeToken) {
    return callHostedApi(files, prTitle, config.analysis, config.vibesafeToken, start);
  }
  return callNvidiaDirect(files, prTitle, config.analysis, config.nvidiaApiKey!, start);
}

async function callNvidiaDirect(
  files: ChangedFile[],
  prTitle: string,
  analysisConfig: AnalysisConfig,
  apiKey: string,
  startMs: number,
): Promise<AnalysisResult> {
  const client = new OpenAI({ apiKey, baseURL: LLM_BASE_URL });

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

  const response = await client.chat.completions.create({
    model:       LLM_MODEL,
    max_tokens:  4096,
    temperature: 0.1,
    // Enforced JSON. This model ignores a bare "return only JSON" instruction
    // often enough to matter, and unparseable output in a security scanner is
    // far worse than a slow one.
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `PR title: "${prTitle}"\n\n${diff}` },
    ],
  });

  const raw     = response.choices[0]?.message?.content ?? '';
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  let parsed: { summary: string; score: number; issues: RawIssue[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Previously this returned score 100 with no issues - a "clean scan". For a
    // security tool that is a silent false negative: a malformed response would
    // report every PR as safe. Fail loudly instead; the action surfaces this as
    // an error and the reviewer knows the scan did not run.
    throw new Error(
      `Model returned unparseable JSON (${LLM_MODEL}). First 200 chars: ${raw.slice(0, 200)}`,
    );
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
    model_used:     LLM_MODEL,
    tokens_used:    (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0),
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
