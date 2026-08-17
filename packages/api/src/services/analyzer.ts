import OpenAI from 'openai';
import {
  ChangedFile, AnalysisConfig, AnalysisResult, Issue, IssueCategory,
  calculateScore, ISSUE_CATEGORIES, buildLineNumberMap, validateLineNumber,
} from '@vibesafe/shared';
import { v4 as uuid } from 'uuid';

// NVIDIA NIM exposes an OpenAI-compatible API, so the OpenAI SDK is the client.
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
const MODEL = process.env.LLM_MODEL ?? 'meta/llama-3.3-70b-instruct';

export async function analyzeDiff(
  files: ChangedFile[],
  prTitle: string,
  config: AnalysisConfig,
): Promise<AnalysisResult> {
  const client = new OpenAI({ apiKey: process.env.NVIDIA_API_KEY, baseURL: LLM_BASE_URL });
  const start  = Date.now();

  const diff = files.map(f =>
    `// FILE: ${f.filename}\n${f.patch ?? '(no patch available)'}`
  ).join('\n\n---\n\n');

  const categoryDefs = Object.entries(ISSUE_CATEGORIES)
    .filter(([cat]) => !config.skip_categories.includes(cat as IssueCategory))
    .map(([cat, def]) => `  - ${cat} (${def.default_severity}): ${def.description}`)
    .join('\n');

  const customRuleDefs = config.custom_rules.length > 0
    ? '\n\nAdditional custom rules to check:\n' +
      config.custom_rules.map(r =>
        `  - ${r.id} (${r.severity}): ${r.description}${r.prompt_hint ? ' ' + r.prompt_hint : ''}`
      ).join('\n')
    : '';

  const systemPrompt = `You are VibeSafe, a security-focused code reviewer specializing in vulnerabilities introduced by AI-generated code.

Analyze ONLY the added lines (lines starting with "+") in the diff below. Ignore removed lines ("-").

Issue categories to detect:
${categoryDefs}${customRuleDefs}

Severity guide:
- critical: exploitable vulnerability, data breach risk, auth bypass
- warning: potential vulnerability, bad practice, likely bug
- info: code quality issue, maintainability concern

For each issue, identify the file path and line number if determinable from the diff.

Return ONLY valid JSON matching this exact schema:
{
  "summary": "one sentence describing what this PR does",
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
    model:       MODEL,
    max_tokens:  4096,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `PR title: "${prTitle}"\n\n${diff}` },
    ],
  });

  const raw     = response.choices[0]?.message?.content ?? '';
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  let parsed: { summary: string; issues: RawIssue[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Previously returned score 100 / no issues, i.e. "clean". For a security
    // scanner that is a silent false negative - malformed output would mark
    // every PR safe. Fail loudly so the caller knows the scan did not run.
    throw new Error(
      `Model returned unparseable JSON (${MODEL}). First 200 chars: ${raw.slice(0, 200)}`,
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
    model_used:     MODEL,
    tokens_used:    (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0),
    analysis_ms:    Date.now() - start,
  };
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
