export type Severity = 'critical' | 'warning' | 'info';

export type IssueCategory =
  | 'SQL_INJECTION'
  | 'HARDCODED_SECRET'
  | 'MISSING_AUTH'
  | 'MISSING_INPUT_VALIDATION'
  | 'ASYNC_RACE_CONDITION'
  | 'MISSING_ERROR_HANDLING'
  | 'EXPOSED_SENSITIVE_DATA'
  | 'DUPLICATE_LOGIC'
  | 'PATH_TRAVERSAL'
  | 'COMMAND_INJECTION';

export interface Issue {
  id: string;
  category: IssueCategory;
  severity: Severity;
  file: string;
  line?: number;
  line_end?: number;
  title: string;
  description: string;
  problematic_code?: string;
  fix: string;
}

export interface ChangedFile {
  filename: string;
  status: 'added' | 'modified' | 'renamed' | 'removed';
  additions: number;
  patch?: string;
  raw_url?: string;
}

export interface AnalysisConfig {
  severity_threshold: Severity;
  fail_on_critical: boolean;
  max_files: number;
  ignore_paths: string[];
  skip_categories: IssueCategory[];
  custom_rules: CustomRule[];
}

export interface AnalysisResult {
  summary: string;
  score: number;
  issues: Issue[];
  files_analyzed: number;
  model_used: string;
  tokens_used: number;
  analysis_ms: number;
}

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  pattern?: string;
  prompt_hint?: string;
}

export interface RepoConfig {
  version: 1;
  severity_threshold?: Severity;
  fail_on_critical?: boolean;
  max_files?: number;
  ignore_paths?: string[];
  skip_categories?: IssueCategory[];
  custom_rules?: CustomRule[];
}

export interface User {
  id: string;
  github_id: number;
  github_login: string;
  github_avatar_url: string;
  email?: string;
  plan: 'free' | 'pro';
  scans_this_month: number;
  scan_limit_per_month: number;
  created_at: Date;
  updated_at: Date;
}

export interface Repo {
  id: string;
  user_id: string;
  github_repo_id: number;
  full_name: string;
  is_private: boolean;
  installed_at: Date;
  last_scanned_at?: Date;
  total_scans: number;
}

export interface Scan {
  id: string;
  repo_id: string;
  pr_number: number;
  pr_title: string;
  pr_url: string;
  head_sha: string;
  score: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  files_analyzed: number;
  issues: Issue[];
  summary: string;
  tokens_used: number;
  analysis_ms: number;
  created_at: Date;
}

export interface ActionOutputs {
  score: string;
  'critical-count': string;
  'warning-count': string;
  'issues-found': string;
}

export interface AnalyzeRequest {
  files: ChangedFile[];
  pr_title?: string;
  config: AnalysisConfig;
}

export interface AnalyzeResponse {
  result: AnalysisResult;
  scan_id?: string;
}
