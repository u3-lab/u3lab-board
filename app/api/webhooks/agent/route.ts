import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { TaskCategory, TaskPriority, TaskSource, TaskStatus } from '@/lib/types';

const VALID_STATUSES: TaskStatus[] = ['today', 'in_progress', 'waiting', 'done', 'someday'];

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? '';

// 同一案件（title+source）の未完了タスクをまとめる対象。手動作成・daily seed分は対象外。
const DEDUP_SOURCES: TaskSource[] = ['webhook_line', 'webhook_slack'];
const MEMO_HISTORY_LIMIT = 5;

function jstTimeLabel(): string {
  const jst = new Date(Date.now() + 9 * 3600 * 1000);
  return jst.toISOString().slice(11, 16);
}

// memoは置換せず追記で履歴化する（直近MEMO_HISTORY_LIMIT件まで）。
// LINEはpermalinkがnullなので、置換だと過去メッセージ本文が復元不能になるため。
function appendMemo(existing: string | null, incoming: string | null): string | null {
  if (!incoming) return existing ?? null;
  const entry = `--- ${jstTimeLabel()} ---\n${incoming}`;
  if (!existing) return entry;
  const blocks = existing.split(/\n(?=--- \d{2}:\d{2} ---)/).filter(Boolean);
  return [...blocks, entry].slice(-MEMO_HISTORY_LIMIT).join('\n');
}

function triage(text: string): { category: TaskCategory | null; priority: TaskPriority } {
  const t = text.toLowerCase();
  let category: TaskCategory | null = null;
  let priority: TaskPriority = 'medium';

  if (/写真|photo|フォト|撮影|レビュー/.test(t)) category = 'photo';
  else if (/相談|soudan|ライフ|ldl/.test(t)) category = 'soudan';
  else if (/明善寺|myozenji|住職|お寺/.test(t)) category = 'myozenji';
  else if (/sns|ig|instagram|リール|投稿/.test(t)) category = 'sns';
  else if (/u3lab|ユースリー|法人|経費/.test(t)) category = 'u3lab';

  if (/急|至急|urgent|今すぐ|asap/.test(t)) priority = 'high';
  else if (/後で|later|いつか|暇な時/.test(t)) priority = 'low';

  return { category, priority };
}

// POST /api/webhooks/agent
// Called by agents (slack-watch, line-bot, etc.) to create tasks
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-agent-secret') ?? '';
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { title, source, memo, assignee, category: categoryOverride, priority: priorityOverride, permalink, source_ref, status, due_date } = body as {
    title: string;
    source: TaskSource;
    memo?: string;
    assignee?: string;
    category?: TaskCategory;
    priority?: TaskPriority;
    permalink?: string;
    source_ref?: string;
    status?: TaskStatus;
    due_date?: string;
  };

  if (!title || !source) {
    return NextResponse.json({ error: 'title and source are required' }, { status: 400 });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const triaged = triage(`${title} ${memo ?? ''}`);
  const category = categoryOverride ?? triaged.category;
  const priority = priorityOverride ?? triaged.priority;

  const db = supabaseAdmin();

  if (DEDUP_SOURCES.includes(source)) {
    const { data: existing } = await db
      .from('tasks')
      .select('id, memo')
      .eq('title', title)
      .eq('source', source)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    const match = existing?.[0];
    if (match) {
      const { data, error } = await db
        .from('tasks')
        .update({
          memo: appendMemo(match.memo, memo ?? null),
          permalink: permalink ?? null,
          source_ref: source_ref ?? null,
          created_at: new Date().toISOString(),
        })
        .eq('id', match.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data, { status: 200 });
    }
  }

  const { data, error } = await db.from('tasks').insert([{
    title,
    status: status ?? 'waiting',
    priority,
    source,
    category,
    memo: memo ?? null,
    permalink: permalink ?? null,
    source_ref: source_ref ?? null,
    assignee: assignee ?? 'yuuki',
    due_date: due_date ?? null,
  }]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
