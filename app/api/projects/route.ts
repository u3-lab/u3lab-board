import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Project } from '@/lib/types';

// GET /api/projects  → all projects with task counts and recent logs
export async function GET() {
  const db = supabaseAdmin();

  const [
    { data: projects, error },
    { data: taskCounts, error: tcErr },
    { data: doneTasks, error: dtErr },
    { data: logs, error: logErr },
  ] = await Promise.all([
    db.from('projects').select('*').order('last_updated', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
    db.from('tasks')
      .select('project_id, status, due_date')
      .not('project_id', 'is', null)
      .is('archived_at', null),
    db.from('tasks')
      .select('id, title, status, completed_at, project_id')
      .not('project_id', 'is', null)
      .eq('status', 'done')
      .order('completed_at', { ascending: false })
      .limit(200),
    db.from('project_log')
      .select('*')
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (tcErr) return NextResponse.json({ error: tcErr.message }, { status: 500 });
  if (dtErr) return NextResponse.json({ error: dtErr.message }, { status: 500 });
  if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });

  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  const countMap = new Map<string, { today: number; upcoming: number }>();
  for (const t of taskCounts ?? []) {
    if (!t.project_id) continue;
    const c = countMap.get(t.project_id) ?? { today: 0, upcoming: 0 };
    if (t.status === 'today') c.today++;
    if (t.due_date && t.due_date >= todayStr && t.status !== 'done') c.upcoming++;
    countMap.set(t.project_id, c);
  }

  const doneTaskMap = new Map<string, typeof doneTasks>();
  for (const t of doneTasks ?? []) {
    if (!t.project_id) continue;
    const arr = doneTaskMap.get(t.project_id) ?? [];
    arr.push(t);
    doneTaskMap.set(t.project_id, arr);
  }

  const logMap = new Map<string, typeof logs>();
  for (const l of logs ?? []) {
    const arr = logMap.get(l.project_id) ?? [];
    arr.push(l);
    logMap.set(l.project_id, arr);
  }

  const withSort = (projects ?? []).map(p => {
    const pLogs = logMap.get(p.id) ?? [];
    // logs は log_date 降順なので先頭が最新
    const maxLogDate = pLogs.length > 0 ? pLogs[0].log_date : null;
    const candidates = [maxLogDate, p.last_updated, p.created_at?.slice(0, 10)].filter(Boolean) as string[];
    const activityDate = candidates.sort().at(-1) ?? '';
    return {
      ...p,
      task_count_today: countMap.get(p.id)?.today ?? 0,
      task_count_upcoming: countMap.get(p.id)?.upcoming ?? 0,
      done_tasks: (doneTaskMap.get(p.id) ?? []).slice(0, 10) as Project['done_tasks'],
      logs: pLogs.slice(0, 10) as Project['logs'],
      _activity: activityDate,
    };
  });

  withSort.sort((a, b) => b._activity.localeCompare(a._activity));

  const result: Project[] = withSort.map(({ _activity, ...p }) => p as Project);

  return NextResponse.json(result);
}

// POST /api/projects
export async function POST(req: NextRequest) {
  const body: Partial<Project> = await req.json();
  const db = supabaseAdmin();
  const { data, error } = await db.from('projects').insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/projects?id=xxx
export async function PATCH(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body: Partial<Project> = await req.json();
  const db = supabaseAdmin();
  const { data, error } = await db.from('projects').update(body).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/projects?id=xxx
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('projects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}
