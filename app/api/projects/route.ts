import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Project } from '@/lib/types';

// GET /api/projects  → all projects with task counts
export async function GET() {
  const db = supabaseAdmin();

  const [{ data: projects, error }, { data: taskCounts, error: tcErr }] = await Promise.all([
    db.from('projects').select('*').order('created_at', { ascending: false }),
    db.from('tasks')
      .select('project_id, status, due_date')
      .not('project_id', 'is', null)
      .is('archived_at', null),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (tcErr) return NextResponse.json({ error: tcErr.message }, { status: 500 });

  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  const countMap = new Map<string, { today: number; upcoming: number }>();
  for (const t of taskCounts ?? []) {
    if (!t.project_id) continue;
    const c = countMap.get(t.project_id) ?? { today: 0, upcoming: 0 };
    if (t.status === 'today') c.today++;
    if (t.due_date && t.due_date >= todayStr && t.status !== 'done') c.upcoming++;
    countMap.set(t.project_id, c);
  }

  const result: Project[] = (projects ?? []).map(p => ({
    ...p,
    task_count_today: countMap.get(p.id)?.today ?? 0,
    task_count_upcoming: countMap.get(p.id)?.upcoming ?? 0,
  }));

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
