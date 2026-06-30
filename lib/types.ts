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
  created_at: string;
  // joined fields (from API)
  task_count_today?: number;
  task_count_upcoming?: number;
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
