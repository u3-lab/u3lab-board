import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface SeedTask {
  title: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

const DAILY_SEEDS: SeedTask[] = [
  { title: 'Slack対応（朝）', category: 'other', priority: 'medium' },
  { title: 'Slack対応（昼）', category: 'other', priority: 'medium' },
  { title: 'Slack対応（夜）', category: 'other', priority: 'medium' },
];

// 0=Sun, 1=Mon, ..., 6=Sat
const WEEKLY_SEEDS: Record<number, SeedTask[]> = {
  1: [{ title: '明善寺報LINE版配信', category: 'myozenji', priority: 'high' }],
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Current JST date string (YYYY-MM-DD) and day-of-week
  const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const jstDate = jstNow.toISOString().slice(0, 10);
  const dayOfWeek = jstNow.getUTCDay();

  const seeds: SeedTask[] = [
    ...DAILY_SEEDS,
    ...(WEEKLY_SEEDS[dayOfWeek] ?? []),
  ];

  const db = supabaseAdmin();
  const todayStartUtc = new Date(`${jstDate}T00:00:00+09:00`).toISOString();

  // Idempotency: fetch today's derived tasks already created
  const { data: existing } = await db
    .from('tasks')
    .select('title')
    .eq('source', 'derived')
    .gte('created_at', todayStartUtc);

  const existingTitles = new Set((existing ?? []).map((t: { title: string }) => t.title));

  const created: string[] = [];
  const skipped: string[] = [];

  for (const seed of seeds) {
    if (existingTitles.has(seed.title)) {
      skipped.push(seed.title);
      continue;
    }
    const { data, error } = await db.from('tasks').insert([{
      title: seed.title,
      status: 'today',
      priority: seed.priority,
      assignee: 'yuuki',
      source: 'derived',
      category: seed.category,
    }]).select('id').single();
    if (!error && data) created.push(data.id);
  }

  return NextResponse.json({ date: jstDate, created: created.length, skipped: skipped.length, ids: created });
}
