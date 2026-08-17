# VibeSafe

AI-powered security review for every pull request. Catches vulnerabilities introduced by AI-generated code before they merge.

## How it works

Add VibeSafe to any repo with a single workflow file. On each PR it analyzes the diff, flags security issues by severity, posts a scored comment, and optionally blocks merge on critical findings.

```yaml
# .github/workflows/vibesafe.yml
name: VibeSafe
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: shlok1806/vibesafe@v1
        with:
          nvidia-api-key: ${{ secrets.NVIDIA_API_KEY }}
```

## What it catches

| Category | Severity |
|---|---|
| SQL Injection | Critical |
| Hardcoded Secrets | Critical |
| Missing Auth | Critical |
| Path Traversal | Critical |
| Command Injection | Critical |
| Missing Input Validation | Warning |
| Async Race Conditions | Warning |
| Missing Error Handling | Warning |
| Exposed Sensitive Data | Warning |
| Duplicate Logic | Info |

## Configuration

Drop a `.vibesafe.yml` in your repo root to customize:

```yaml
version: 1
severity_threshold: warning   # only report warning and above
fail_on_critical: true        # block merge on critical issues
max_files: 30
ignore_paths:
  - "**/*.test.ts"
  - "migrations/**"
skip_categories:
  - DUPLICATE_LOGIC
custom_rules:
  - id: no-console-log
    name: No console.log in production
    severity: warning
    description: console.log statements left in production code
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `nvidia-api-key` | — | Your NVIDIA API key, `nvapi-...` (BYO mode) |
| `vibesafe-token` | — | Hosted API token (alternative to BYO) |
| `severity-threshold` | `warning` | Minimum severity to report |
| `fail-on-critical` | `false` | Exit 1 if any critical issues found |
| `max-files` | `20` | Max files analyzed per PR |
| `inline-comments` | `false` | Post inline comments on specific lines |

## Outputs

| Output | Description |
|---|---|
| `score` | Security score 0–100 |
| `critical-count` | Number of critical issues |
| `warning-count` | Number of warnings |
| `issues-found` | `true` if any issues were found |

## Monorepo layout

```
packages/
  action/   GitHub Action (Node.js 20, compiled with ncc)
  api/      Backend API (Express + PostgreSQL + Redis)
  web/      Dashboard (Next.js) — coming soon
  shared/   Shared TypeScript types and utilities
```

## Development

```bash
npm install
cd packages/shared && npm run build
cd packages/action && npm run build   # compiles to dist/index.js
cd packages/api && npm run dev
```

Run tests:
```bash
cd packages/action && npm test
```
