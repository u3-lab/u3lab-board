import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Task } from '@/lib/types';

// GET /api/tasks?status=today
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const db = supabaseAdmin();
  let query = db
    .from('tasks')
    .select('*')
    .is('archived_at', null)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
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
  const db = supabaseAdmin();
  const { data, error } = await db.from('tasks').update(body).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
