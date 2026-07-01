export type TaskStatus = 'today' | 'in_progress' | 'waiting' | 'done' | 'someday';
export type ProjectStatus = 'active' | 'waiting' | 'stalled' | 'done';
export type BlockerType = 'external' | 'internal' | 'none';

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  category?: string | null;
  assignees: string[];
  assignee_role?: string | null;
  due_date?: string | null;
  last_updated?: string | null;
  next_action?: string | null;
  blocker_type?: BlockerType | null;
  blocker_detail?: string | null;
  provenance?: string | null;
  summary?: string | null;
  created_at: string;
  // joined fields (from API)
  task_count_today?: number;
  task_count_upcoming?: number;
  logs?: ProjectLog[];
  done_tasks?: Task[];
}

export interface ProjectLog {
  id: string;
  project_id: string;
  log_date: string;
  content: string;
  source?: string | null;
  entry_type: 'progress' | 'milestone_done';
  created_at: string;
}
export type ReelKind = 'shokunin' | 'shashinka' | 'ldl';
export type ReelStatus = '下書き' | '収録待ち' | '収録済み' | '撮影済み' | '編集待ち' | '予約済み' | '投稿済み' | '削除予定';

export interface Reel {
  id: string;
  kind: ReelKind;
  theme?: string | null;
  status: ReelStatus;
  publish_date?: string | null;
  request_date?: string | null;
  memo?: string | null;
  koyomi_meta?: string | null;
  chatgpt_url?: string | null;
  script?: string | null;
  caption?: string | null;
  extra?: Record<string, unknown> | null;
  created_at: string;
  posted_at?: string | null;
  notion_id?: string | null;
}

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskSource = 'manual' | 'webhook_line' | 'webhook_slack' | 'derived';
export type TaskCategory = 'photo' | 'soudan' | 'myozenji' | 'u3lab' | 'sns' | 'other';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  assignee: string;
  source: TaskSource;
  category?: TaskCategory | null;
  memo?: string | null;
  permalink?: string | null;
  source_ref?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  archived_at?: string | null;
  agent_id?: string | null;
  project_id?: string | null;
}
