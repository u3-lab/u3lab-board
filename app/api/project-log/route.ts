import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { ProjectLog } from '@/lib/types';

// POST /api/project-log
export async function POST(req: NextRequest) {
  const body: Partial<ProjectLog> = await req.json();
  if (!body.project_id || !body.content) {
    return NextResponse.json({ error: 'project_id and content required' }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db.from('project_log').insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/project-log?id=xxx
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = supabaseAdmin();
  const { error } = await db.from('project_log').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}
