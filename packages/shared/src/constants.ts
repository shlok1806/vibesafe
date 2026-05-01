import type { IssueCategory, Severity, AnalysisConfig } from './types';

export const ISSUE_CATEGORIES: Record<IssueCategory, {
  label: string;
  default_severity: Severity;
  description: string;
}> = {
  SQL_INJECTION: {
    label: 'SQL Injection',
    default_severity: 'critical',
    description: 'User input interpolated directly into SQL queries',
  },
  HARDCODED_SECRET: {
    label: 'Hardcoded Secret',
    default_severity: 'critical',
    description: 'API keys, tokens, or passwords committed to source',
  },
  MISSING_AUTH: {
    label: 'Missing Auth',
    default_severity: 'critical',
    description: 'Endpoint modifies data with no authentication check',
  },
  MISSING_INPUT_VALIDATION: {
    label: 'Missing Input Validation',
    default_severity: 'warning',
    description: 'User input passed to filesystem, DB, or external service without validation',
  },
  ASYNC_RACE_CONDITION: {
    label: 'Async Race Condition',
    default_severity: 'warning',
    description: 'Shared state mutated across concurrent async operations',
  },
  MISSING_ERROR_HANDLING: {
    label: 'Missing Error Handling',
    default_severity: 'warning',
    description: 'Network calls or DB queries with no try/catch or error boundary',
  },
  EXPOSED_SENSITIVE_DATA: {
    label: 'Exposed Sensitive Data',
    default_severity: 'warning',
    description: 'Passwords, tokens, or PII logged or returned in API responses',
  },
  DUPLICATE_LOGIC: {
    label: 'Duplicate Logic',
    default_severity: 'info',
    description: 'Function or constant that already exists elsewhere in the codebase',
  },
  PATH_TRAVERSAL: {
    label: 'Path Traversal',
    default_severity: 'critical',
    description: 'User-controlled input used in file path construction',
  },
  COMMAND_INJECTION: {
    label: 'Command Injection',
    default_severity: 'critical',
    description: 'User input passed to shell exec or subprocess without sanitization',
  },
};

export const DEFAULT_CONFIG: AnalysisConfig = {
  severity_threshold: 'warning',
  fail_on_critical: false,
  max_files: 20,
  ignore_paths: [
    '**/*.lock',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/go.sum',
    '**/pnpm-lock.yaml',
    '**/*.min.js',
    '**/dist/**',
    '**/build/**',
    '**/__snapshots__/**',
  ],
  skip_categories: [],
  custom_rules: [],
};

export const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp',
  'pdf', 'woff', 'woff2', 'ttf', 'eot',
  'mp4', 'mp3', 'wav', 'zip', 'tar', 'gz',
]);

export const SCORE_THRESHOLDS = {
  CRITICAL_PENALTY: 25,
  WARNING_PENALTY: 8,
  INFO_PENALTY: 2,
};
