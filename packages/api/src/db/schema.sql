-- Users (authenticated via GitHub OAuth)
CREATE TABLE users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id            INTEGER UNIQUE NOT NULL,
  github_login         VARCHAR(255) NOT NULL,
  github_avatar_url    TEXT,
  email                VARCHAR(255),
  plan                 VARCHAR(20) NOT NULL DEFAULT 'free',
  scans_this_month     INTEGER NOT NULL DEFAULT 0,
  scan_limit_per_month INTEGER NOT NULL DEFAULT 50,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API tokens (for GitHub Action hosted mode)
CREATE TABLE api_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL UNIQUE,
  name         VARCHAR(255),
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Repos (GitHub repos where VibeSafe is installed)
CREATE TABLE repos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_repo_id    INTEGER NOT NULL,
  full_name         VARCHAR(512) NOT NULL,
  is_private        BOOLEAN NOT NULL DEFAULT false,
  installed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_scanned_at   TIMESTAMPTZ,
  total_scans       INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, github_repo_id)
);

-- Scans (one per PR analysis)
CREATE TABLE scans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id        UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  pr_number      INTEGER NOT NULL,
  pr_title       TEXT,
  pr_url         TEXT,
  head_sha       VARCHAR(40),
  score          INTEGER NOT NULL,
  critical_count INTEGER NOT NULL DEFAULT 0,
  warning_count  INTEGER NOT NULL DEFAULT 0,
  info_count     INTEGER NOT NULL DEFAULT 0,
  files_analyzed INTEGER NOT NULL DEFAULT 0,
  issues         JSONB NOT NULL DEFAULT '[]',
  summary        TEXT,
  tokens_used    INTEGER,
  analysis_ms    INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scans_repo_id    ON scans(repo_id);
CREATE INDEX idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX idx_repos_user_id    ON repos(user_id);
CREATE INDEX idx_api_tokens_hash  ON api_tokens(token_hash);
