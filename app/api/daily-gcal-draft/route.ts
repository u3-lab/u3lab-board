import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Task } from '@/lib/types';
import { writeTaskToDraftCalendar } from '@/lib/gcal-draft';

// POST /api/daily-gcal-draft  — called by task scheduler at 23:00 JST
// バックアップ網：PATCH /api/tasks のイベント駆動フックが何らかの理由で
// 書き込めなかった分（gcal_event_id が未設定のタスク）だけを拾う（2026-07-06 イベント駆動化に伴い変更）。
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 対象日: ?date=YYYY-MM-DD が指定されればそれ（backfill用）、無ければ today in JST（通常の夜間バッチ）
  const dateParam = req.nextUrl.searchParams.get('date');
  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: 'invalid date param, expected YYYY-MM-DD' }, { status: 400 });
  }
  const nowJst = new Date(Date.now() + 9 * 3600 * 1000);
  const todayStr = dateParam ?? nowJst.toISOString().slice(0, 10);

  const db = supabaseAdmin();
  const { data: tasks, error } = await db
    .from('tasks')
    .select('*')
    .eq('status', 'done')
    .is('gcal_event_id', null)
    .gte('completed_at', `${todayStr}T00:00:00+09:00`)
    .lte('completed_at', `${todayStr}T23:59:59+09:00`)
    .order('completed_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ message: 'no unwritten done tasks today', count: 0 });
  }

  const results: { id: string; title: string; gcalId: string | null; error?: string }[] = [];

  for (const task of tasks as Task[]) {
    try {
      const gcalId = await writeTaskToDraftCalendar(task);
      if (gcalId) {
        await db.from('tasks').update({ gcal_event_id: gcalId }).eq('id', task.id);
      }
      results.push({ id: task.id, title: task.title, gcalId });
    } catch (e) {
      results.push({ id: task.id, title: task.title, gcalId: null, error: String(e) });
    }
  }

  const ok = results.filter(r => !r.error).length;
  const fail = results.filter(r => r.error).length;

  return NextResponse.json({
    date: todayStr,
    total: tasks.length,
    ok,
    fail,
    results,
  });
}
