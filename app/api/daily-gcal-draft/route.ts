import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase';
import type { Task } from '@/lib/types';

const DRAFT_CALENDAR_NAME = '02行動_下書き';

function getAuth() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');
  const credentials = JSON.parse(credJson);
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

async function getOrCreateDraftCalendarId(auth: ReturnType<typeof getAuth>): Promise<string> {
  const calendar = google.calendar({ version: 'v3', auth });
  const list = await calendar.calendarList.list();
  const existing = list.data.items?.find(c => c.summary === DRAFT_CALENDAR_NAME);
  if (existing?.id) return existing.id;

  const created = await calendar.calendars.insert({
    requestBody: { summary: DRAFT_CALENDAR_NAME },
  });
  return created.data.id!;
}

// POST /api/daily-gcal-draft  — called by task scheduler at 23:00 JST
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // today in JST
  const nowJst = new Date(Date.now() + 9 * 3600 * 1000);
  const todayStr = nowJst.toISOString().slice(0, 10);

  const db = supabaseAdmin();
  const { data: tasks, error } = await db
    .from('tasks')
    .select('*')
    .eq('status', 'done')
    .gte('completed_at', `${todayStr}T00:00:00+09:00`)
    .lte('completed_at', `${todayStr}T23:59:59+09:00`)
    .order('completed_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ message: 'no done tasks today', count: 0 });
  }

  let auth: ReturnType<typeof getAuth>;
  try {
    auth = getAuth();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 });
  }

  const calendarId = await getOrCreateDraftCalendarId(auth);
  const calendar = google.calendar({ version: 'v3', auth });

  const results: { id: string; title: string; gcalId: string | null; error?: string }[] = [];

  for (const task of tasks as Task[]) {
    try {
      const completedAt = task.completed_at ? new Date(task.completed_at) : new Date();
      const startedAt = task.started_at
        ? new Date(task.started_at)
        : new Date(completedAt.getTime() - 30 * 60 * 1000);

      const estimated = !task.started_at;
      const sourceLabel = task.source === 'webhook_line' ? 'LINE'
        : task.source === 'webhook_slack' ? 'Slack'
        : task.source === 'manual' ? '手動'
        : task.source;

      const descParts: string[] = [];
      if (estimated) descParts.push('⚠️開始時刻未取得（推定）');
      if (task.memo) descParts.push(task.memo);
      descParts.push(`source: ${sourceLabel}`);
      if (task.category) descParts.push(`category: ${task.category}`);

      const event = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: task.title,
          description: descParts.join('\n'),
          start: { dateTime: startedAt.toISOString(), timeZone: 'Asia/Tokyo' },
          end: { dateTime: completedAt.toISOString(), timeZone: 'Asia/Tokyo' },
        },
      });

      results.push({ id: task.id, title: task.title, gcalId: event.data.id ?? null });
    } catch (e) {
      results.push({ id: task.id, title: task.title, gcalId: null, error: String(e) });
    }
  }

  const ok = results.filter(r => !r.error).length;
  const fail = results.filter(r => r.error).length;

  return NextResponse.json({
    date: todayStr,
    calendarId,
    total: tasks.length,
    ok,
    fail,
    results,
  });
}
