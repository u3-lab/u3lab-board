export type TaskStatus = 'today' | 'in_progress' | 'waiting' | 'done' | 'someday';
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
  created_at: string;
  completed_at?: string | null;
  archived_at?: string | null;
  agent_id?: string | null;
}
