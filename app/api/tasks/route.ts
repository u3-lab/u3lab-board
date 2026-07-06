import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Task } from '@/lib/types';
import { writeTaskToDraftCalendar } from '@/lib/gcal-draft';

// GET /api/tasks                    → non-archived tasks
// GET /api/tasks?completed_today=true → today's done tasks (JST)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const completedToday = searchParams.get('completed_today') === 'true';

  const db = supabaseAdmin();

  if (completedToday) {
    const jstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const todayStartUtc = new Date(`${jstDate}T00:00:00+09:00`).toISOString();
    const { data, error } = await db
      .from('tasks')
      .select('*')
      .not('archived_at', 'is', null)
      .gte('completed_at', todayStartUtc)
      .order('completed_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  let query = db
    .from('tasks')
    .select('*')
    .is('archived_at', null)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/tasks
export async function POST(req: NextRequest) {
  const body: Partial<Task> & { agent_id?: string } = await req.json();
  const db = supabaseAdmin();
  const { data, error } = await db.from('tasks').insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/tasks?id=xxx
export async function PATCH(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body: Partial<Task> & { agent_id?: string } = await req.json();
  const now = new Date().toISOString();
  const updates: typeof body = { ...body };

  if (body.status === 'done') {
    updates.completed_at = now;
    updates.archived_at = now;
  }

  const db = supabaseAdmin();
  const { data, error } = await db.from('tasks').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // イベント駆動での02行動_下書きカレンダー反映（完了時のみ・冪等・失敗しても完了処理自体は継続）
  // gcal_event_id 済みなら二重書き込み防止でskip（PATCHの再呼び出し等に対して安全）。
  // 失敗時は gcal_event_id が未設定のまま残り、daily-gcal-draft のバックアップ網が翌日拾う。
  if (body.status === 'done' && data && !data.gcal_event_id) {
    try {
      const gcalEventId = await writeTaskToDraftCalendar(data as Task);
      if (gcalEventId) {
        await db.from('tasks').update({ gcal_event_id: gcalEventId }).eq('id', id);
        data.gcal_event_id = gcalEventId;
      }
    } catch (e) {
      console.error('gcal draft write failed (non-fatal, daily backup will retry):', e);
    }
  }

  return NextResponse.json(data);
}

// DELETE /api/tasks?id=xxx  (admin cleanup only — no auth beyond Vercel deployment)
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('tasks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}
