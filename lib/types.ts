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
  no?: number | null;
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
export type ReelKind = 'shokunin' | 'shashinka' | 'ldl' | 'kokoro' | 'other';
export type ReelStatus = '下書き' | '収録待ち' | '撮影済み' | '予約済み' | '投稿済み' | '削除予定';
export type ReelStage = 'idea' | 'writing' | 'production';

export interface Reel {
  id: string;
  kind: ReelKind;
  theme?: string | null;
  status: ReelStatus;
  stage?: ReelStage | null;
  publish_date?: string | null;
  request_date?: string | null;
  memo?: string | null;
  koyomi_meta?: string | null;
  chatgpt_url?: string | null;
  script?: string | null;
  caption?: string | null;
  post_url?: string | null;
  source_ref?: string | null;
  extra?: Record<string, unknown> | null;
  created_at: string;
  posted_at?: string | null;
  notion_id?: string | null;
}

export type ConsultationStatus = '未対応' | '対応中' | '祐紀さん返信待ち' | '完了';

export interface Consultation {
  id: string;
  consultant_name: string;
  contact_ref?: string | null;
  channel: string;
  content: string;
  status: ConsultationStatus;
  reply_draft?: string | null;
  danger_flag: boolean;
  danger_note?: string | null;
  danger_flagged_at?: string | null;
  danger_ack: boolean;
  danger_ack_at?: string | null;
  received_at: string;
  completed_at?: string | null;
  archived_at?: string | null;
  source_ref?: string | null;
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
  gcal_event_id?: string | null;
}
