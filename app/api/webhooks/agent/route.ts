import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { TaskCategory, TaskPriority, TaskSource } from '@/lib/types';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? '';

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
  const { title, source, memo, assignee } = body as {
    title: string;
    source: TaskSource;
    memo?: string;
    assignee?: string;
  };

  if (!title || !source) {
    return NextResponse.json({ error: 'title and source are required' }, { status: 400 });
  }

  const { category, priority } = triage(`${title} ${memo ?? ''}`);

  const db = supabaseAdmin();
  const { data, error } = await db.from('tasks').insert([{
    title,
    status: 'waiting',
    priority,
    source,
    category,
    memo: memo ?? null,
    assignee: assignee ?? 'yuuki',
  }]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
