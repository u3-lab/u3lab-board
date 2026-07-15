-- U3LAB Board - Phase1 Schema
-- Run this in Supabase SQL Editor after creating a new project

CREATE TYPE task_status   AS ENUM ('today', 'in_progress', 'waiting', 'done', 'someday');
CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE task_source   AS ENUM ('manual', 'webhook_line', 'webhook_slack', 'derived');
CREATE TYPE task_category AS ENUM ('photo', 'soudan', 'myozenji', 'u3lab', 'sns', 'other');

CREATE TABLE tasks (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT          NOT NULL,
  status        task_status   NOT NULL DEFAULT 'today',
  priority      task_priority NOT NULL DEFAULT 'medium',
  due_date      DATE,
  assignee      TEXT          NOT NULL DEFAULT 'yuuki',
  source        task_source   NOT NULL DEFAULT 'manual',
  category      task_category,
  memo          TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  archived_at   TIMESTAMPTZ,
  agent_id      TEXT,
  permalink     TEXT,
  source_ref    TEXT,
  started_at    TIMESTAMPTZ,
  gcal_event_id TEXT
);

CREATE INDEX idx_tasks_status    ON tasks (status)    WHERE archived_at IS NULL;
CREATE INDEX idx_tasks_assignee  ON tasks (assignee)  WHERE archived_at IS NULL;
CREATE INDEX idx_tasks_due_date  ON tasks (due_date)  WHERE archived_at IS NULL;
CREATE UNIQUE INDEX tasks_source_ref_unique ON tasks (source_ref) WHERE source_ref IS NOT NULL;

-- Auto-archive when status set to done
CREATE OR REPLACE FUNCTION auto_archive() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status <> 'done' THEN
    NEW.completed_at = NOW();
    NEW.archived_at  = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_done
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION auto_archive();

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
-- Authenticated users (Yuuki): full access
CREATE POLICY "authenticated_all" ON tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- service_role bypasses RLS automatically (for agents)

-- Schedules table (Google Calendar mirror) — Phase 1 後半
CREATE TABLE schedules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gcal_event_id   TEXT        UNIQUE NOT NULL,
  calendar_id     TEXT        NOT NULL,
  calendar_label  TEXT,
  title           TEXT        NOT NULL,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  all_day         BOOLEAN     NOT NULL DEFAULT FALSE,
  location        TEXT,
  description     TEXT,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON schedules FOR SELECT TO authenticated USING (true);

-- Reels table (リール配信管理 Phase C)
CREATE TABLE reels (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT         NOT NULL CHECK (kind IN ('shokunin', 'shashinka', 'ldl')),
  theme        TEXT,
  status       TEXT         NOT NULL DEFAULT '下書き'
               CHECK (status IN ('下書き', '収録待ち', '撮影済み', '編集待ち', '予約済み', '投稿済み', '削除予定')),
  publish_date DATE,
  request_date DATE,
  memo         TEXT,
  koyomi_meta  TEXT,
  chatgpt_url  TEXT,
  script       TEXT,
  caption      TEXT,
  extra        JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  posted_at    TIMESTAMPTZ,
  notion_id    TEXT
);

CREATE INDEX idx_reels_status       ON reels (status);
CREATE INDEX idx_reels_publish_date ON reels (publish_date);
CREATE INDEX idx_reels_kind         ON reels (kind);

ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON reels
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Projects table (プロジェクト一覧・俯瞰ビュー)
CREATE TABLE projects (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'waiting', 'stalled', 'done')),
  category       TEXT,
  assignees      TEXT[]      NOT NULL DEFAULT '{}',
  assignee_role  TEXT,
  due_date       DATE,
  last_updated   DATE,
  next_action    TEXT,
  blocker_type   TEXT        CHECK (blocker_type IN ('external', 'internal', 'none')),
  blocker_detail TEXT,
  provenance     TEXT,
  summary        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  no             INTEGER
);

CREATE UNIQUE INDEX projects_no_uidx ON projects (no) WHERE no IS NOT NULL;

-- No.（通し番号）は一度振ったら不変。新規プロジェクトは自動でmax+1を採番。
CREATE OR REPLACE FUNCTION assign_project_no() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.no IS NULL THEN
    NEW.no := (SELECT COALESCE(MAX(no), 0) + 1 FROM projects);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assign_project_no
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION assign_project_no();

-- tasks ⇄ projects 連携（プロジェクトが存在してから追加する必要があるためALTERで追記）
ALTER TABLE tasks ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX tasks_project_id_idx ON tasks (project_id);

-- RLS: 現在無効（service_role/APIルート経由のみで運用中）

-- Project log table (プロジェクトごとの活動ログ・中粒度)
CREATE TABLE project_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  log_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  content      TEXT        NOT NULL,
  source       TEXT,
  entry_type   TEXT        NOT NULL DEFAULT 'progress'
               CHECK (entry_type IN ('progress', 'milestone_done')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX project_log_project_id_idx ON project_log (project_id);
CREATE INDEX project_log_log_date_idx   ON project_log (log_date DESC);

ALTER TABLE project_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON project_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Consultations table（相談専用ツール・脱Notion・2026-07-15）
-- 相談内容は最も繊細な個人情報。外部LLM APIには一切渡さない（board側の実装原則）。
CREATE TYPE consultation_status AS ENUM ('未対応','対応中','祐紀さん返信待ち','完了');

CREATE TABLE consultations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_name    TEXT NOT NULL,
  contact_ref        TEXT,
  channel            TEXT NOT NULL,
  content            TEXT NOT NULL,
  status             consultation_status NOT NULL DEFAULT '未対応',
  reply_draft        TEXT,
  danger_flag        BOOLEAN NOT NULL DEFAULT FALSE,
  danger_note        TEXT,
  danger_flagged_at  TIMESTAMPTZ,
  danger_ack         BOOLEAN NOT NULL DEFAULT FALSE,
  danger_ack_at      TIMESTAMPTZ,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,
  archived_at        TIMESTAMPTZ,
  source_ref         TEXT
);

CREATE INDEX idx_consultations_open        ON consultations (received_at DESC) WHERE archived_at IS NULL;
CREATE INDEX idx_consultations_danger_open ON consultations (danger_flagged_at DESC) WHERE danger_flag = TRUE AND danger_ack = FALSE;

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON consultations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- service_roleはRLSバイパス（agent経由の書き込み用）
